// Registro de asistencia: se marca la entrada con la cédula del cliente.
// Solo entra quien tiene una membresía vigente hoy. RN-3.2: una entrada por cliente por día.
const express = require('express');
const { Op, UniqueConstraintError } = require('sequelize');
const { hoy } = require('../db');
const { Cliente, Membresia, Asistencia } = require('../modelos');
const { requierePermiso } = require('../seguridad');
const v = require('../validacion');

const router = express.Router();

async function entradasDeHoy() {
  return Asistencia.findAll({
    where: { fecha: hoy() },
    include: [{ model: Cliente, as: 'cliente', attributes: ['nombre'] }, { model: Membresia, as: 'membresia', attributes: ['codigo', 'fecha_vencimiento'] }],
    order: [['hora', 'DESC']],
  });
}

async function pantalla(res, estado = 200, extra = {}) {
  res.status(estado).render('asistencia/registrar', { titulo: 'Registrar entrada', cedula: '', resultado: null, entradas: await entradasDeHoy(), ...extra });
}

router.get('/', async (req, res, next) => {
  try { await pantalla(res); } catch (err) { next(err); }
});

router.post('/', requierePermiso('CREAR'), async (req, res, next) => {
  try {
    const cedula = v.texto(req.body.cedula);
    const negar = (texto) => pantalla(res, 400, { cedula, resultado: { ok: false, texto } });
    if (!v.patrones.cedula.test(cedula)) return negar('Escriba una cédula válida.');

    const cliente = await Cliente.findOne({ where: { cedula } });// consulta parametrizada por el ORM
    if (!cliente) return negar('No hay ningún cliente con esa cédula.');

    const h = hoy();
    const vigente = await Membresia.findOne({
      where: { cliente_id: cliente.id, fecha_inicio: { [Op.lte]: h }, fecha_vencimiento: { [Op.gte]: h } },
    });
    if (!vigente) return negar(`${cliente.nombre} no tiene una membresía vigente. No puede entrar.`);

    try {
      await Asistencia.create({ cliente_id: cliente.id, membresia_id: vigente.id, fecha: h, registrado_por: req.usuario.id });
    } catch (err) {
      if (err instanceof UniqueConstraintError) return negar(`${cliente.nombre} ya registró su entrada hoy (RN-3.2).`);
      throw err;
    }
    const vence = vigente.fecha_vencimiento.split('-').reverse().join('/');
    await pantalla(res, 200, { resultado: { ok: true, texto: `Bienvenido(a), ${cliente.nombre}. Membresía ${vigente.codigo} vigente hasta el ${vence}.` } });
  } catch (err) { next(err); }
});

module.exports = router;