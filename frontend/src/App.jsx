import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import SiteLayout from './components/SiteLayout';
import { useAuth } from './context/AuthContext';
import './pages/Site.css';

function App() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

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

  // Utilisateur connecté : l'application de chat.
  if (user) {
    return <Chat />;
  }

  // Visiteur : pages publiques (accueil, tarifs) puis connexion / inscription.
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
      </Route>
      <Route
        path="/login"
        element={
          <>
            <Link to="/" className="back-home">
              ← Accueil
            </Link>
            <Login onLoginSuccess={login} onSwitchToRegister={() => navigate('/register')} />
          </>
        }
      />
      <Route
        path="/register"
        element={
          <>
            <Link to="/" className="back-home">
              ← Accueil
            </Link>
            <Register onRegisterSuccess={login} onSwitchToLogin={() => navigate('/login')} />
          </>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
