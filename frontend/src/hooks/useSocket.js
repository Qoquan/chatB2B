import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Hook de connexion Socket.io — à utiliser une fois l'authentification en place
export function useSocket(token) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [token]);

  return socketRef.current;
}
