import React from "react";

export default function Message({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`message ${isUser ? "user" : "assistant"}`}>
      <div className={`avatar ${isUser ? "user-avatar" : "bot-avatar"}`}>
        {isUser ? "U" : "AI"}
      </div>
      <div className="message-content">{content}</div>
    </div>
  );
}
