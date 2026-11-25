// Crea las tablas y carga los datos de ejemplo (scripts SQL de la carpeta db/)
//   npm run db:init              -> borra y vuelve a crear todo
//   node db/init.js --si-vacia   -> solo si la base está vacía (lo usa Render al arrancar)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const cliente = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  try {
    await cliente.connect();
    if (process.argv.includes('--si-vacia')) {
      const { rows } = await cliente.query("SELECT to_regclass('public.usuarios') AS t");
      if (rows[0].t) return console.log('La base ya tiene tablas: no se reinicia.');
    }
    for (const archivo of ['schema.sql', 'datos.sql']) {
      await cliente.query(fs.readFileSync(path.join(__dirname, archivo), 'utf8'));
      console.log('OK', archivo);
    }
    const { rows } = await cliente.query('SELECT COUNT(*)::int AS n FROM usuarios');
    console.log(`Listo: ${rows[0].n} usuarios de prueba cargados.`);
  } catch (err) {
    console.error('ERROR al crear la base:', err.message);
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
})();