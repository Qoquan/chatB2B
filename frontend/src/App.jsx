import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';

// Point de départ minimal — à étoffer par l'équipe frontend :
// router (liste conversations, fenêtre de chat), context d'authentification,
// connexion Socket.io, etc.
function App() {
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login');

  if (!user) {
    return authView === 'login' ? (
      <Login
        onLoginSuccess={(data) => setUser(data.user)}
        onSwitchToRegister={() => setAuthView('register')}
      />
    ) : (
      <Register
        onRegisterSuccess={(data) => setUser(data.user)}
        onSwitchToLogin={() => setAuthView('login')}
      />
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Bienvenue {user.username} 👋</h1>
      <p>Connecté ! Prochaine étape : liste des conversations et chat en temps réel.</p>
    </div>
  );
}

export default App;
