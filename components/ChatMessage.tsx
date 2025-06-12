import React from 'react';

interface MessageProps {
  message: {
    id: string;
    text: string;
    sender: string;
    timestamp: string;
  };
}

const ChatMessage: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const messageClass = isUser ? 'user-message' : 'agent-message';

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className={`chat-message ${messageClass}`}>
      <div className="message-sender">{message.sender}</div>
      <div className="message-text">{message.text}</div>
      <div className="message-timestamp">{formatTimestamp(message.timestamp)}</div>
    </div>
  );
};

export default ChatMessage;
