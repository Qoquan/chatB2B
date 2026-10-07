import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, login, loading } = useAuth();
  const [authView, setAuthView] = useState('login');

  // Vérification de la session mémorisée (peut prendre quelques secondes si le
  // serveur Render vient de se réveiller).
  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>ChatB2B</h1>
          <p className="subtitle">Connexion au serveur… 🐾</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return authView === 'login' ? (
      <Login onLoginSuccess={login} onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <Register onRegisterSuccess={login} onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  return <Chat />;
}

export default App;
