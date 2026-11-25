// Panel de inicio: resumen del día, últimas entradas y membresías próximas a vencer
const express = require('express');
const { Op } = require('sequelize');
const { Cliente, Membresia, Asistencia } = require('../modelos');
const { hoy } = require('../db');
const { sumarDias, DIAS_POR_VENCER } = require('../membresias');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const h = hoy();
    const enRango = { fecha_inicio: { [Op.lte]: h }, fecha_vencimiento: { [Op.between]: [h, sumarDias(h, DIAS_POR_VENCER)] } };
    const resumen = {
      entradasHoy: await Asistencia.count({ where: { fecha: h } }),
      vigentes: await Membresia.count({ where: { fecha_inicio: { [Op.lte]: h }, fecha_vencimiento: { [Op.gte]: h } } }),
      porVencer: await Membresia.count({ where: enRango }),
      clientes: await Cliente.count(),
    };
    const entradas = await Asistencia.findAll({
      where: { fecha: h }, include: [{ model: Cliente, as: 'cliente', attributes: ['nombre'] }], order: [['hora', 'DESC']], limit: 5,
    });
    const proximas = await Membresia.findAll({
      where: enRango, include: [{ model: Cliente, as: 'cliente', attributes: ['nombre'] }], order: [['fecha_vencimiento', 'ASC']], limit: 5,
    });
    const dias = (f) => Math.round((Date.parse(f) - Date.parse(h)) / 86400000);
    const fechaLarga = new Date().toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: 'numeric', month: 'long', year: 'numeric' });
    res.render('inicio', { titulo: 'Inicio', resumen, entradas, proximas, dias, fechaLarga });
  } catch (err) { next(err); }
});

module.exports = router;