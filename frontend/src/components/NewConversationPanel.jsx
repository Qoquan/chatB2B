function NewConversationPanel({ users, onSelectUser, onClose }) {
  return (
    <div className="new-conversation-panel">
      <div className="new-conversation-header">
        <span>Nouvelle conversation</span>
        <button onClick={onClose}>✕</button>
      </div>
      <ul>
        {users.map((u) => (
          <li key={u.id} onClick={() => onSelectUser(u.id)}>
            {u.username}
          </li>
        ))}
        {users.length === 0 && <li className="empty">Aucun autre utilisateur</li>}
      </ul>
    </div>
  );
}

export default NewConversationPanel;
