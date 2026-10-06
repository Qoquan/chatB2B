import { useState } from 'react';

function NewConversationPanel({ users, onSelectUser, onCreateGroup, onClose }) {
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState(null);

  function toggleMember(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    setError(null);
    const result = await onCreateGroup({
      name: groupName,
      avatarUrl: groupAvatarUrl,
      memberIds: selectedIds,
    });
    if (result?.error) setError(result.error);
  }

  return (
    <div className="new-conversation-panel">
      <div className="new-conversation-header">
        <span>{groupMode ? 'Nouveau groupe' : 'Nouvelle conversation'}</span>
        <button onClick={onClose}>✕</button>
      </div>

      {!groupMode ? (
        <>
          <ul>
            {users.map((u) => (
              <li key={u.id} onClick={() => onSelectUser(u.id)}>
                {u.username}
              </li>
            ))}
            {users.length === 0 && <li className="empty">Aucun autre utilisateur</li>}
          </ul>
          <button className="group-toggle" onClick={() => setGroupMode(true)}>
            👥 Créer un groupe
          </button>
        </>
      ) : (
        <form className="group-form" onSubmit={handleCreateGroup}>
          <input
            type="text"
            placeholder="Nom du groupe"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={100}
            required
          />
          <input
            type="url"
            placeholder="Photo du groupe (URL https, facultatif)"
            value={groupAvatarUrl}
            onChange={(e) => setGroupAvatarUrl(e.target.value)}
          />
          <div className="group-members">
            {users.map((u) => (
              <label key={u.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={() => toggleMember(u.id)}
                />
                {u.username}
              </label>
            ))}
            {users.length === 0 && <span className="empty">Aucun autre utilisateur</span>}
          </div>
          <button type="submit" disabled={!groupName.trim() || selectedIds.length === 0}>
            Créer le groupe ({selectedIds.length})
          </button>
          <button type="button" className="group-toggle" onClick={() => setGroupMode(false)}>
            ← Retour
          </button>
          {error && <div className="profile-message error">{error}</div>}
        </form>
      )}
    </div>
  );
}

export default NewConversationPanel;
