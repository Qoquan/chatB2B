import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, login } = useAuth();
  const [authView, setAuthView] = useState('login');

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
