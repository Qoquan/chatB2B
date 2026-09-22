const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Les tests d'intégration (DB + Socket.io) sont plus lents que des
    // tests unitaires classiques ; on laisse une marge confortable.
    testTimeout: 15000,
    hookTimeout: 15000,
    // Un seul worker : évite que plusieurs fichiers de test touchent la
    // même base de données en parallèle et se marchent dessus.
    fileParallelism: false,
  },
});
