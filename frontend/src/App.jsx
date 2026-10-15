import { useCallback, useEffect, useRef, useState } from "react";
import Message from "./components/Message.jsx";
import Sidebar from "./components/Sidebar.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";


const DEFAULT_MODEL = "gemini-2.5-flash";
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
];
const SUGGESTIONS = [
  ["Search latest web info", "Search the web for latest AI agent news."],
  ["Summarize uploaded document", "Summarize the document I uploaded."],
  ["Save something to memory", "Remember that my channel name is MyGPT."],
  ["Use calculator tool", "Calculate 125 * 48 / 6"]
];

function createThreadId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function guessTool(message) {
  const text = message.toLowerCase();
  if (/remember that|save this|store this|keep in memory|memorize/.test(text)) return "Memory Save";
  if (/what do you remember|recall|my memory|remember about me/.test(text)) return "Memory Recall";
  if (/document|pdf|file|uploaded|summarize|summary|according to|based on/.test(text)) return "Document Search";
  if (/latest|current|today|now|recent|news|search web|web search|internet|online|price|version|update|2025|2026|who is|trending|release/.test(text)) return "Web Search";
  if (/(\d+\s*[\+\-*\/]\s*\d+)|calculate|calculation|math|solve/.test(text)) return "Calculator";
  return "";
}

export default function App() {
  const [threadId, setThreadId] = useState(() => {
    const saved = localStorage.getItem("thread_id");
    if (saved) return saved;
    const id = createThreadId();
    localStorage.setItem("thread_id", id);
    return id;
  });
  const [model, setModel] = useState(() => localStorage.getItem("selected_model") || DEFAULT_MODEL);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [toolStatus, setToolStatus] = useState("");
  const [notice, setNotice] = useState("MyGPT can make mistakes. Check important information.");
  const [dictating, setDictating] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const dictatingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("selected_model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem("thread_id", threadId);
  }, [threadId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, toolStatus]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }, []);

  const loadConversation = useCallback(async (selectedId) => {
    setThreadId(selectedId);
    setMessages([]);
    setToolStatus("");
    setStatus("Loading chat...");
    try {
      const response = await fetch(`${API_BASE}/history/${encodeURIComponent(selectedId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMessages((data.messages || []).map((item, index) => ({
        id: `${selectedId}-${index}-${Date.now()}`,
        role: item.role === "user" ? "user" : "assistant",
        content: item.content || ""
      })));
    } catch (error) {
      setNotice(`Could not load conversation: ${error.message}`);
    } finally {
      setStatus("Ready");
      await loadConversations();
    }
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
    loadConversation(threadId);
  }, []); // Load the persisted current thread once on startup.

  function newChat() {
    if (dictatingRef.current) stopDictation();
    const id = createThreadId();
    setThreadId(id);
    setMessages([]);
    setToolStatus("");
    setStatus("Ready");
    setNotice("MyGPT can make mistakes. Check important information.");
    textareaRef.current?.focus();
  }

  function usePrompt(prompt) {
    setMessage(prompt);
    textareaRef.current?.focus();
  }

  function handleTextareaKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleMessageChange(event) {
    setMessage(event.target.value);
    const element = event.target;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 170)}px`;
  }

  function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      dictatingRef.current = true;
      setDictating(true);
      setStatus("Listening...");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += `${transcript} `;
        else interimText += transcript;
      }
      if (finalText) setMessage((previous) => `${previous.trim()} ${finalText.trim()}`.trim());
      if (interimText) setNotice(`Listening: ${interimText}`);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") setNotice("Microphone permission denied. Allow microphone access in your browser.");
      stopDictation();
    };
    recognition.onend = () => {
      if (dictatingRef.current) {
        try { recognition.start(); } catch { stopDictation(); }
      }
    };
    return recognition;
  }

  function toggleDictation() {
    if (!recognitionRef.current) recognitionRef.current = setupRecognition();
    if (!recognitionRef.current) {
      setNotice("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (dictatingRef.current) stopDictation();
    else {
      try { recognitionRef.current.start(); } catch (error) { console.error(error); }
    }
  }

  function stopDictation() {
    dictatingRef.current = false;
    setDictating(false);
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    setStatus("Ready");
    setNotice("MyGPT can make mistakes. Check important information.");
  }

  function parseSSEPart(part) {
    const dataLines = part.split(/\r?\n/).filter((line) => line.trim().startsWith("data:"));
    if (!dataLines.length) return null;
    const jsonText = dataLines.map((line) => line.replace(/^data:\s*/, "")).join("\n").trim();
    if (!jsonText || jsonText === "[DONE]") return null;
    try { return JSON.parse(jsonText); } catch { return null; }
  }

  async function sendMessage() {
    const text = message.trim();
    if (!text || busy) return;
    if (dictatingRef.current) stopDictation();

    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const assistantId = createThreadId();
    setMessages((previous) => [
      ...previous,
      { id: createThreadId(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" }
    ]);
    setBusy(true);
    const likelyTool = guessTool(text);
    setToolStatus(likelyTool ? `Using ${likelyTool}...` : "");
    setStatus(likelyTool ? `Using ${likelyTool}...` : `Thinking with ${model}...`);
    setNotice("MyGPT can make mistakes. Check important information.");

    let assistantText = "";
    let buffer = "";
    let firstToken = false;

    const processEvent = (data) => {
      if (!data) return;
      if (data.token !== undefined && data.token !== null) {
        assistantText += data.token;
        setMessages((previous) => previous.map((item) =>
          item.id === assistantId ? { ...item, content: assistantText } : item
        ));
        if (!firstToken) {
          firstToken = true;
          setToolStatus(likelyTool ? `${likelyTool} completed` : "");
        }
        setStatus(`Generating with ${model}...`);
      }
      if (data.error) {
        assistantText += `\n\nError: ${data.error}`;
        setMessages((previous) => previous.map((item) =>
          item.id === assistantId ? { ...item, content: assistantText } : item
        ));
      }
      if (data.done) {
        setStatus("Ready");
        if (likelyTool && !firstToken) setToolStatus(`${likelyTool} completed`);
      }
    };

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, thread_id: threadId, model })
      });
      if (!response.ok) {
        let errorMessage = `Request failed (HTTP ${response.status}).`;
        try {
          const data = await response.json();
          errorMessage = data.detail || data.message || data.error || errorMessage;
        } catch { /* response was not JSON */ }
        throw new Error(errorMessage);
      }
      if (!response.body) throw new Error("Streaming is not supported by this browser.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || "";
        for (const part of parts) processEvent(parseSSEPart(part));
      }
      buffer += decoder.decode();
      if (buffer.trim()) processEvent(parseSSEPart(buffer));
    } catch (error) {
      assistantText = assistantText ? `${assistantText}\n\nError: ${error.message}` : `Error: ${error.message}`;
      setMessages((previous) => previous.map((item) =>
        item.id === assistantId ? { ...item, content: assistantText } : item
      ));
      setNotice("Could not complete that request. Check that the backend is running.");
    } finally {
      setBusy(false);
      setStatus("Ready");
      setToolStatus("");
      await loadConversations();
      textareaRef.current?.focus();
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessages((previous) => [
      ...previous,
      { id: createThreadId(), role: "user", content: `📎 Uploaded document: ${file.name}` }
    ]);
    setStatus("Uploading and processing document...");
    setToolStatus("Document Ingestion...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("thread_id", threadId);
    try {
      const response = awaitfetch(`${API_BASE}/upload` , { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.detail || "Upload failed.");
      setMessages((previous) => [
        ...previous,
        { id: createThreadId(), role: "assistant", content: `${data.message}\n\nYou can now ask questions about this document.` }
      ]);
      await loadConversations();
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { id: createThreadId(), role: "assistant", content: `Upload failed: ${error.message}` }
      ]);
    } finally {
      setStatus("Ready");
      setToolStatus("");
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        threadId={threadId}
        onNewChat={newChat}
        onSelectConversation={loadConversation}
      />
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">MyGPT <span className="subtitle">Agentic AI Assistant</span></div>
          <div className="status">{status}</div>
        </header>

        <section className="chat-container" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="welcome">
              <h1>How can I help you today?</h1>
              <p>Ask questions, upload documents, use tools, search the web, and chat with memory.</p>
              <div className="cards">
                {SUGGESTIONS.map(([label, prompt]) => (
                  <button className="card" key={label} onClick={() => usePrompt(prompt)}>{label}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((item) => <Message key={item.id} role={item.role} content={item.content} />)}
            </div>
          )}
          {toolStatus && (
            <div className="tool-progress">
              <div className="tool-progress-box">
                {toolStatus.endsWith("completed") ? <span className="tool-check">✓</span> : <span className="tool-spinner" />}
                <span>{toolStatus}</span>
              </div>
            </div>
          )}
        </section>

        <footer className="input-area">
          <div className="input-wrapper">
            <input
              ref={fileRef}
              type="file"
              className="hidden-file"
              accept=".pdf,.docx,.txt,.md,.py,.csv"
              onChange={uploadFile}
            />
            <button className="icon-btn attach-btn" onClick={() => fileRef.current?.click()} title="Upload document" aria-label="Upload document">📎</button>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Ask anything..."
              rows={1}
              aria-label="Message"
            />
            <select className="model-select" value={model} onChange={(event) => setModel(event.target.value)} title="Select model" aria-label="Select model">
              {MODELS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button className={`icon-btn mic-btn ${dictating ? "recording" : ""}`} onClick={toggleDictation} title="Dictate" aria-label="Dictate">{dictating ? "⏹️" : "🎙️"}</button>
            <button className="send-btn" onClick={sendMessage} disabled={!message.trim() || busy} title="Send message" aria-label="Send message">{busy ? "…" : "➜"}</button>
          </div>
          <div className="notice">{notice}</div>
        </footer>
      </main>
    </div>
  );
}
