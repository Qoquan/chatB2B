import { useState } from 'react';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL;

const CATS = [
  { top: '10%', left: '8%', size: '1.8rem', delay: '0.3s' },
  { top: '18%', left: '82%', size: '2rem', delay: '1.2s' },
  { top: '72%', left: '88%', size: '1.5rem', delay: '2.1s' },
  { top: '82%', left: '10%', size: '2rem', delay: '0.8s' },
  { top: '48%', left: '5%', size: '1.3rem', delay: '1.8s' },
  { top: '38%', left: '90%', size: '1.6rem', delay: '2.6s' },
];

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
        setMessage({ type: 'error', text: data.error || 'Erreur lors de l\'inscription' });
        return;
      }

      localStorage.setItem('token', data.token);
      setMessage({ type: 'success', text: `Bienvenue ${data.user.username} 🐱` });
      onRegisterSuccess?.(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de contacter le serveur' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {CATS.map((c, i) => (
        <span
          key={i}
          className="cat"
          style={{ top: c.top, left: c.left, fontSize: c.size, animationDelay: c.delay }}
        >
          🐱
        </span>
      ))}

      <div className="login-card">
        <h1>ChatB2B</h1>
        <p className="subtitle">Crée ton compte 🐾</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Création...' : "S'inscrire"}
          </button>
        </form>

        {message && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <p className="switch-link" onClick={onSwitchToLogin}>
          Déjà un compte ? Se connecter
        </p>
      </div>
    </div>
  );
}

export default Register;
