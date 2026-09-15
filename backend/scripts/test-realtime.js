/**
 * Script de test manuel pour valider le chat 1:1 en temps réel.
 * Simule 2 clients Socket.io connectés en même temps :
 * - clientA envoie un message dans une conversation
 * - clientB doit le recevoir en direct via l'événement "new_message"
 */

const { io } = require('socket.io-client');

const SOCKET_URL = 'https://chatb2b-backend-root.onrender.com';
const TOKEN_A =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlMDc0YWFmOC1hN2M1LTQzYjgtYmM5MC00ZTliNjBkMTU1OTgiLCJpYXQiOjE3ODk0OTY4NzAsImV4cCI6MTc5MDEwMTY3MH0.f2CbOHm8lJnQHUBQ-jWVnK7-FJVBcg5IXmRhQ3rWBPk';
const TOKEN_B =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiYjk5Yjc5NC01NTZkLTQzODYtOTc0ZC03YjRkOWVmMjMxMTAiLCJpYXQiOjE3ODk0OTY4ODcsImV4cCI6MTc5MDEwMTY4N30.0z2x0v5hx6dFdraCBrYzHBEK5MPRuBkgdHA9gJB05x4';
const CONVERSATION_ID = 'e88fbd5a-95e9-420d-8a41-eff5ea924d95';

let received = false;

const clientA = io(SOCKET_URL, { auth: { token: TOKEN_A } });
const clientB = io(SOCKET_URL, { auth: { token: TOKEN_B } });

function fail(message) {
  console.error(`❌ ÉCHEC : ${message}`);
  process.exit(1);
}

function finishSuccess() {
  console.log('✅ SUCCÈS : le message a bien été reçu en temps réel par clientB.');
  clientA.disconnect();
  clientB.disconnect();
  process.exit(0);
}

clientA.on('connect_error', (err) => fail(`clientA n'a pas pu se connecter (${err.message})`));
clientB.on('connect_error', (err) => fail(`clientB n'a pas pu se connecter (${err.message})`));

clientA.on('connect', () => console.log('clientA connecté, socket id =', clientA.id));
clientB.on('connect', () => console.log('clientB connecté, socket id =', clientB.id));

clientB.on('new_message', (message) => {
  received = true;
  console.log('clientB a reçu un message :', message.content);
  finishSuccess();
});

clientB.on('error_message', (err) => fail(`clientB a reçu une erreur serveur : ${err.error}`));
clientA.on('error_message', (err) => fail(`clientA a reçu une erreur serveur : ${err.error}`));

let bothConnected = 0;
function onBothConnected() {
  bothConnected += 1;
  if (bothConnected < 2) return;

  clientA.emit('join_conversations', [CONVERSATION_ID]);
  clientB.emit('join_conversations', [CONVERSATION_ID]);

  setTimeout(() => {
    console.log('clientA envoie un message...');
    clientA.emit('send_message', {
      conversationId: CONVERSATION_ID,
      content: 'Message de test temps réel 🚀',
    });
  }, 500);
}

clientA.on('connect', onBothConnected);
clientB.on('connect', onBothConnected);

setTimeout(() => {
  if (!received) fail('timeout — aucun message reçu après 10 secondes');
}, 10000);
