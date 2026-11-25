// Inicio y cierre de sesión
const express = require('express');
const argon2 = require('argon2');
const { Usuario } = require('../modelos');
const { registrar } = require('../bitacora');

const router = express.Router();

// Si el usuario no existe, igual se verifica contra este hash falso: la respuesta tarda
// lo mismo y no se puede adivinar qué usuarios existen.
const HASH_FALSO = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$Vt6WzqVwJ7tQmYwqzG8b0B9n0VQ8xg3nq3cQ4oQb1Yk';

const pantalla = (req, extra = {}) => ({
  titulo: 'Iniciar sesión', error: null, username: '',
  expirada: req.query.expirada === '1', requiere: req.query.requiere === '1', ...extra,
});

router.get('/login', (req, res) => {
  if (req.usuario) return res.redirect('/');
  res.render('login', pantalla(req));
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().slice(0, 30);
    const password = String(req.body.password || '').slice(0, 128);

    // El ORM busca con parámetros: ' OR '1'='1 es solo un nombre de usuario más
    const usuario = await Usuario.findOne({ where: { username } });
    const valida = await argon2.verify(usuario ? usuario.password_hash : HASH_FALSO, password).catch(() => false);

    if (!usuario || !valida || !usuario.activo) {
      await registrar(req, 'LOGIN_FALLIDO', `Intento con usuario: ${username}`, usuario);
      return res.status(401).render('login', { ...pantalla(req), expirada: false, requiere: false, username, error: 'Usuario o contraseña incorrectos.' });
    }

    // Sesión nueva al entrar: nadie puede reutilizar un id de sesión anterior
    req.session.regenerate(async (err) => {
      if (err) return next(err);
      req.session.usuarioId = usuario.id;
      req.session.ultimaActividad = Date.now();
      await usuario.update({ ultimo_login: new Date() });
      await registrar(req, 'LOGIN_OK', 'Inicio de sesión exitoso', usuario);
      req.session.save((e) => (e ? next(e) : res.redirect('/')));
    });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res) => {
  if (req.usuario) await registrar(req, 'LOGOUT', 'Cierre de sesión');
  req.session.destroy(() => {
    res.clearCookie('kova.sid');
    res.redirect('/login');
  });
});

module.exports = router;