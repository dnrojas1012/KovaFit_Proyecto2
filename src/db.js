// El ORM arma consultas parametrizadas: el texto del usuario nunca se pega en el SQL
require('dotenv').config({ quiet: true });
const { Sequelize } = require('sequelize');

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en el archivo .env');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  timezone: '-06:00', // hora de Costa Rica
  dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
});

// Fecha de hoy en Costa Rica (AAAA-MM-DD)
function hoy() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
}

module.exports = { sequelize, hoy };