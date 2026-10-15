import React from "react";

export default function Sidebar({
  conversations,
  threadId,
  onNewChat,
  onSelectConversation
}) {
  return (
    <aside className="sidebar">
      <div className="brand">MyGPT</div>
      <button className="new-chat" onClick={onNewChat}>＋ New chat</button>
      <div className="history-title">Recent Chats</div>
      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="history-empty">No chats yet</div>
        ) : conversations.map((conversation) => (
          <button
            key={conversation.thread_id}
            className={`history-item ${conversation.thread_id === threadId ? "active" : ""}`}
            onClick={() => onSelectConversation(conversation.thread_id)}
            title={conversation.title || "New Chat"}
          >
            {conversation.title || "New Chat"}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">Your conversations are saved by the backend.</div>
    </aside>
  );
}
