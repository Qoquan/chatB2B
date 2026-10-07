import { useEffect, useState } from 'react';
import { getUserName } from '../utils/userName';

const API_URL = import.meta.env.VITE_API_URL;

function GroupSettings({ conversation, currentUserId, token, onClose, onDeleted }) {
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const isCreator = conversation.createdById === currentUserId;
  const memberIds = new Set(conversation.members.map((m) => m.user.id));

  const [name, setName] = useState(conversation.name || '');
  const [avatarUrl, setAvatarUrl] = useState(conversation.avatarUrl || '');
  const [infoMessage, setInfoMessage] = useState(null);

  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [membersMessage, setMembersMessage] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((users) => setAvailableUsers(users.filter((u) => !memberIds.has(u.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, conversation.members.length]);

  async function handleInfoSubmit(e) {
    e.preventDefault();
    setInfoMessage(null);
    const res = await fetch(`${API_URL}/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ name, avatarUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInfoMessage({ type: 'error', text: data.error });
      return;
    }
    setInfoMessage({ type: 'success', text: 'Groupe mis à jour' });
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAddMembers() {
    setMembersMessage(null);
    const res = await fetch(`${API_URL}/api/conversations/${conversation.id}/members`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userIds: selectedIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMembersMessage({ type: 'error', text: data.error });
      return;
    }
    setSelectedIds([]);
    setMembersMessage({ type: 'success', text: 'Membres ajoutés' });
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer le groupe « ${conversation.name} » et tous ses messages ?`)) {
      return;
    }
    const res = await fetch(`${API_URL}/api/conversations/${conversation.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) {
      setInfoMessage({ type: 'error', text: data.error });
      return;
    }
    onDeleted(conversation.id);
  }

  return (
    <div className="chat-window profile-page">
      <div className="profile-header">
        <h2>Paramètres du groupe</h2>
        <button onClick={onClose}>Fermer</button>
      </div>

      <form className="profile-form" onSubmit={handleInfoSubmit}>
        <label>
          Nom du groupe
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </label>
        <label>
          URL de la photo
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <button type="submit">Enregistrer</button>
        {infoMessage && (
          <div className={`profile-message ${infoMessage.type}`}>{infoMessage.text}</div>
        )}
      </form>

      <div className="profile-form">
        <h3>Membres ({conversation.members.length})</h3>
        <ul className="member-list">
          {conversation.members.map((m) => (
            <li key={m.user.id}>
              {getUserName(m.user)}
              {m.user.id === conversation.createdById && ' (créateur)'}
            </li>
          ))}
        </ul>

        <h3>Ajouter des membres</h3>
        {availableUsers.length === 0 ? (
          <span className="empty">Tous vos contacts sont déjà dans ce groupe</span>
        ) : (
          <div className="group-members">
            {availableUsers.map((u) => (
              <label key={u.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={() => toggleSelected(u.id)}
                />
                {u.username}
              </label>
            ))}
          </div>
        )}
        <button onClick={handleAddMembers} disabled={selectedIds.length === 0}>
          Ajouter ({selectedIds.length})
        </button>
        {membersMessage && (
          <div className={`profile-message ${membersMessage.type}`}>{membersMessage.text}</div>
        )}
      </div>

      {isCreator && (
        <div className="profile-form">
          <h3>Zone dangereuse</h3>
          <button className="danger-button" onClick={handleDelete}>
            Supprimer le groupe
          </button>
        </div>
      )}
    </div>
  );
}

export default GroupSettings;
