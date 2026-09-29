const { createServer } = require('./server');

const { server } = createServer();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur ChatB2B démarré sur le port ${PORT}`);
});
