import { useState } from 'react';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL;

const CATS = [
  { top: '8%', left: '10%', size: '2rem', delay: '0s' },
  { top: '15%', left: '80%', size: '1.4rem', delay: '1s' },
  { top: '75%', left: '85%', size: '2.2rem', delay: '2s' },
  { top: '80%', left: '12%', size: '1.6rem', delay: '0.5s' },
  { top: '45%', left: '4%', size: '1.2rem', delay: '1.5s' },
  { top: '40%', left: '92%', size: '1.8rem', delay: '2.5s' },
];

function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Erreur de connexion' });
        return;
      }

      localStorage.setItem('token', data.token);
      setMessage({ type: 'success', text: `Bienvenue ${data.user.username} 🐱` });
      onLoginSuccess?.(data);
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
        <p className="subtitle">Connecte-toi pour discuter 🐾</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {message && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <p className="switch-link" onClick={onSwitchToRegister}>
          Pas de compte ? S'inscrire
        </p>
      </div>
    </div>
  );
}

export default Login;
