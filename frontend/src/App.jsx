import { useState } from 'react';

// Point de départ minimal — à étoffer par l'équipe frontend :
// router (login, liste conversations, fenêtre de chat),
// context d'authentification, connexion Socket.io, etc.
function App() {
  const [message, setMessage] = useState('Bienvenue sur ChatB2B 👋');

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>{message}</h1>
      <p>Squelette React (Vite) — à connecter à l'API backend et à Socket.io.</p>
    </div>
  );
}

export default App;
