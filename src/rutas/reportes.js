// Reporte de membresías por vencer en los próximos 7 días.
// Requiere el permiso VER_REPORTES
const express = require('express');
const { Op } = require('sequelize');
const { hoy } = require('../db');
const { Cliente, Membresia } = require('../modelos');
const { requierePermiso } = require('../seguridad');
const { sumarDias, DIAS_POR_VENCER } = require('../membresias');

const router = express.Router();

router.get('/por-vencer', requierePermiso('VER_REPORTES'), async (req, res, next) => {
  try {
    const h = hoy();
    const limite = sumarDias(h, DIAS_POR_VENCER);
    const membresias = await Membresia.findAll({
      where: { fecha_inicio: { [Op.lte]: h }, fecha_vencimiento: { [Op.between]: [h, limite] } },
      include: [{ model: Cliente, as: 'cliente', attributes: ['nombre', 'telefono'] }],
      order: [['fecha_vencimiento', 'ASC']],
    });
    const dias = (f) => Math.round((Date.parse(f) - Date.parse(h)) / 86400000);
    res.render('reportes/por-vencer', { titulo: 'Por vencer', membresias, dias, desde: h, hasta: limite });
  } catch (err) { next(err); }
});

module.exports = router;