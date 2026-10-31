import { useState } from 'react';
import './Login.css';
import './RememberMe.css';

const API_URL = import.meta.env.VITE_API_URL;

function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Erreur de connexion' });
        return;
      }

      setMessage({ type: 'success', text: `Bienvenue ${data.user.username}` });
      onLoginSuccess?.(data, rememberMe);
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
        <p className="subtitle">Connectez-vous à votre espace d’équipe</p>

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
            type="password"
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Se souvenir de moi pendant 8 jours</span>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="button" className="switch-link" onClick={onSwitchToRegister}>
          Pas de compte ? S'inscrire
        </button>
      </div>
    </div>
  );
}

export default Login;
