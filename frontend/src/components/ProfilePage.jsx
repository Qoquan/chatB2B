import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

function ProfilePage({ onClose }) {
  const { token, updateUser, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileMessage, setProfileMessage] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        setEmail(data.email);
        setUsername(data.username);
        setAvatarUrl(data.avatarUrl || '');
      });
  }, [token]);

  async function request(method, path, body) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return { ok: res.ok, data };
    } catch (err) {
      return { ok: false, data: { error: 'Impossible de contacter le serveur' } };
    }
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileMessage(null);

    const { ok, data } = await request('PATCH', '/api/users/me', { username, avatarUrl });
    if (!ok) {
      setProfileMessage({ type: 'error', text: data.error });
      return;
    }

    updateUser({ username: data.username, avatarUrl: data.avatarUrl });
    setUsername(data.username);
    setAvatarUrl(data.avatarUrl || '');
    setProfileMessage({ type: 'success', text: 'Profil mis à jour' });
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordMessage(null);

    const { ok, data } = await request('PUT', '/api/users/me/password', {
      currentPassword,
      newPassword,
    });
    if (!ok) {
      setPasswordMessage({ type: 'error', text: data.error });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setPasswordMessage({ type: 'success', text: 'Mot de passe modifié' });
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (!window.confirm('Supprimer définitivement votre compte et vos messages ?')) return;

    setDeleteMessage(null);
    const { ok, data } = await request('DELETE', '/api/users/me', {
      currentPassword: deletePassword,
    });
    if (!ok) {
      setDeleteMessage({ type: 'error', text: data.error });
      return;
    }
    logout();
  }

  return (
    <div className="chat-window profile-page">
      <div className="profile-header">
        <h2>Mon profil</h2>
        <button onClick={onClose}>Fermer</button>
      </div>

      <form className="profile-form" onSubmit={handleProfileSubmit}>
        <label>
          Email
          <input type="email" value={email} disabled />
        </label>
        <label>
          Nom d'utilisateur
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={30}
            required
          />
        </label>
        <label>
          URL de l'avatar
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <button type="submit">Enregistrer</button>
        {profileMessage && (
          <div className={`profile-message ${profileMessage.type}`}>{profileMessage.text}</div>
        )}
      </form>

      <form className="profile-form" onSubmit={handlePasswordSubmit}>
        <h3>Changer le mot de passe</h3>
        <label>
          Mot de passe actuel
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Nouveau mot de passe (8 caractères minimum)
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit">Changer le mot de passe</button>
        {passwordMessage && (
          <div className={`profile-message ${passwordMessage.type}`}>{passwordMessage.text}</div>
        )}
      </form>

      <form className="profile-form" onSubmit={handleDeleteAccount}>
        <h3>Supprimer mon compte</h3>
        <p className="danger-text">
          Action irréversible : vos messages et votre compte seront supprimés définitivement.
        </p>
        <label>
          Mot de passe (confirmation)
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="danger-button">
          Supprimer définitivement mon compte
        </button>
        {deleteMessage && (
          <div className={`profile-message ${deleteMessage.type}`}>{deleteMessage.text}</div>
        )}
      </form>
    </div>
  );
}

export default ProfilePage;
