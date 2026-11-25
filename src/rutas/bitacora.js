// Bitácora: quién hizo qué, cuándo y desde dónde. Solo la ve el SuperAdmin.
const express = require('express');
const { Bitacora } = require('../modelos');
const { soloSuperAdmin } = require('../seguridad');

const router = express.Router();
const EVENTOS = ['LOGIN_OK', 'LOGIN_FALLIDO', 'LOGOUT', 'ACCESO_DENEGADO', 'CSRF_RECHAZADO', 'CAMBIO_ROL', 'CAMBIO_PERMISOS',
  'USUARIO_CREADO', 'USUARIO_EDITADO', 'USUARIO_BORRADO', 'ROL_CREADO', 'ROL_BORRADO'];

router.get('/', soloSuperAdmin, async (req, res, next) => {
  try {
    const evento = EVENTOS.includes(req.query.evento) ? req.query.evento : '';   // lista blanca
    const registros = await Bitacora.findAll({ where: evento ? { evento } : {}, order: [['fecha', 'DESC']], limit: 200 });
    res.render('bitacora/lista', { titulo: 'Bitácora', registros, evento, EVENTOS });
  } catch (err) { next(err); }
});

module.exports = router;