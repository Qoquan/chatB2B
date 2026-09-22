function MessageBubble({ message, isOwn }) {
  const time = new Date(message.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-bubble ${isOwn ? 'own' : ''}`}>
      {!isOwn && <div className="message-author">{message.sender.username}</div>}
      <div className="message-content">{message.content}</div>
      <div className="message-time">{time}</div>
    </div>
  );
}

export default MessageBubble;
