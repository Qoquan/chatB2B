import { useState } from 'react';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL;

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || "Erreur lors de l'inscription" });
        return;
      }

      setMessage({ type: 'success', text: `Bienvenue ${data.user.username}` });
      onRegisterSuccess?.(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de contacter le serveur' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>
          <span aria-hidden="true">🐾</span> ChatB2B
        </h1>
        <p className="subtitle">Créez votre compte en quelques secondes</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            aria-label="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Création...' : "S'inscrire"}
          </button>
        </form>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="button" className="switch-link" onClick={onSwitchToLogin}>
          Déjà un compte ? Se connecter
        </button>
      </div>
    </div>
  );
}

export default Register;
