
const express = require('express');
const { Op } = require('sequelize');
const { sequelize, hoy } = require('../db');
const { Cliente, Membresia } = require('../modelos');
const { requierePermiso } = require('../seguridad');
const v = require('../validacion');
const reglas = require('../membresias');

const router = express.Router();
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function leerFormulario(body) {
  const datos = {
    cliente_id: v.entero(body.cliente_id),
    plan: v.texto(body.plan).toUpperCase(),
    fecha_inicio: v.texto(body.fecha_inicio),
    monto: v.texto(body.monto).replace(',', '.'),
  };
  const errores = [];
  if (!datos.cliente_id) errores.push('Seleccione un cliente.');
  if (!reglas.PLANES[datos.plan]) errores.push('Seleccione un plan: mensual, trimestral o anual.');
  if (!FECHA.test(datos.fecha_inicio) || Number.isNaN(Date.parse(datos.fecha_inicio))) errores.push('La fecha de inicio no es válida.');
  // el monto debe ser mayor que cero (la base también lo exige con un CHECK)
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(datos.monto) || !(Number(datos.monto) > 0)) errores.push('El monto debe ser un número mayor que cero.');
  return { datos, errores };
}

// Guarda dentro de una transacción. Bloquea al cliente para que dos ventas al mismo
// tiempo no se salten la regla
async function guardar(datos, { membresia = null, renovadaDe = null, usuarioId }) {
  return sequelize.transaction(async (t) => {
    const cliente = await Cliente.findByPk(datos.cliente_id, { lock: true, transaction: t });
    if (!cliente) return { error: 'El cliente no existe.' };
    const vence = reglas.calcularVencimiento(datos.fecha_inicio, datos.plan);
    const choque = await reglas.buscarTraslape(cliente.id, datos.fecha_inicio, vence, membresia && membresia.id);
    if (choque) return { error: `El cliente ya tiene la membresía ${choque.codigo} vigente hasta el ${choque.fecha_vencimiento.split("-").reverse().join("/")}. Solo puede tener una (RN-3.1).` };
    const valores = { plan: datos.plan, fecha_inicio: datos.fecha_inicio, fecha_vencimiento: vence, monto: datos.monto };
    if (membresia) {
      await membresia.update(valores, { transaction: t });
      return { codigo: membresia.codigo, vence };
    }
    const nueva = await Membresia.create({ ...valores, cliente_id: cliente.id, renovada_de: renovadaDe, creado_por: usuarioId },
      { transaction: t, returning: true });
    await nueva.reload({ transaction: t }); // trae el código que generó la base
    return { codigo: nueva.codigo, vence };
  });
}

const listarClientes = () => Cliente.findAll({ attributes: ['id', 'nombre'], order: [['nombre', 'ASC']] });
const buscar = (id) => Membresia.findByPk(v.entero(id) || 0, { include: { model: Cliente, as: 'cliente', attributes: ['nombre'] } });
const fechaCR = (texto) => texto.split('-').reverse().join('/');

// ---------- Lista y búsqueda ----------
router.get('/', async (req, res, next) => {
  try {
    const q = v.texto(req.query.q).slice(0, 50);
    // q viaja como parámetro; UTN-07b: se muestra con <%= %> (escapado)
    const where = q ? { [Op.or]: [{ codigo: { [Op.iLike]: `%${q}%` } }, { '$cliente.nombre$': { [Op.iLike]: `%${q}%` } }] } : {};
    const h = hoy();
    const filas = await Membresia.findAll({ where, include: { model: Cliente, as: 'cliente', attributes: ['nombre'] }, order: [['fecha_vencimiento', 'DESC']] });
    // Solo se ofrece "Renovar" en la membresía más reciente de cada cliente
    const ultima = {};
    (await Membresia.findAll({ attributes: ['cliente_id', 'fecha_vencimiento'] })).forEach((x) => {
      if (!ultima[x.cliente_id] || x.fecha_vencimiento > ultima[x.cliente_id]) ultima[x.cliente_id] = x.fecha_vencimiento;
    });
    const membresias = filas.map((m) => ({
      renovable: ['Vencida', 'Por vencer'].includes(reglas.estado(m, h)) && ultima[m.cliente_id] === m.fecha_vencimiento,
      id: m.id, codigo: m.codigo, cliente: m.cliente.nombre, plan: m.plan,
      inicio: fechaCR(m.fecha_inicio), vence: fechaCR(m.fecha_vencimiento),
      monto: Number(m.monto).toLocaleString('es-CR'), estado: reglas.estado(m, h),
    }));
    res.render('membresias/lista', { titulo: 'Membresías', membresias, q });
  } catch (err) { next(err); }
});

// ---------- Vender (crear) ----------
router.get('/nueva', requierePermiso('CREAR'), async (req, res, next) => {
  try {
    res.render('membresias/form', {
      titulo: 'Vender membresía', id: null, errores: [], clientes: await listarClientes(),
      datos: { cliente_id: v.entero(req.query.cliente_id), plan: 'MENSUAL', fecha_inicio: hoy(), monto: '' },
    });
  } catch (err) { next(err); }
});

router.post('/', requierePermiso('CREAR'), async (req, res, next) => {
  try {
    const { datos, errores } = leerFormulario(req.body);
    if (!errores.length) {
      const r = await guardar(datos, { usuarioId: req.usuario.id });
      if (!r.error) {
        req.session.aviso = { tipo: 'ok', texto: `Membresía ${r.codigo} vendida. Vence el ${fechaCR(r.vence)}.` };
        return res.redirect('/membresias');
      }
      errores.push(r.error);
    }
    res.status(400).render('membresias/form', { titulo: 'Vender membresía', id: null, errores, datos, clientes: await listarClientes() });
  } catch (err) { next(err); }
});

// ---------- Editar ----------
router.get('/:id/editar', requierePermiso('EDITAR'), async (req, res, next) => {
  try {
    const m = await buscar(req.params.id);
    if (!m) return next();
    res.render('membresias/form', { titulo: `Editar membresía ${m.codigo}`, id: m.id, errores: [], datos: m.get(), clientes: await listarClientes() });
  } catch (err) { next(err); }
});

router.post('/:id', requierePermiso('EDITAR'), async (req, res, next) => {
  try {
    const m = await buscar(req.params.id);
    if (!m) return next();
    const { datos, errores } = leerFormulario({ ...req.body, cliente_id: String(m.cliente_id) }); // el cliente no cambia
    if (!errores.length) {
      const r = await guardar(datos, { membresia: m, usuarioId: req.usuario.id });
      if (!r.error) {
        req.session.aviso = { tipo: 'ok', texto: `Membresía ${r.codigo} actualizada.` };
        return res.redirect('/membresias');
      }
      errores.push(r.error);
    }
    res.status(400).render('membresias/form', { titulo: `Editar membresía ${m.codigo}`, id: m.id, errores, datos, clientes: await listarClientes() });
  } catch (err) { next(err); }
});

// ---------- Borrar ----------
router.post('/:id/eliminar', requierePermiso('BORRAR'), async (req, res, next) => {
  try {
    const m = await buscar(req.params.id);
    if (!m) return next();
    if (await Membresia.count({ where: { renovada_de: m.id } })) {
      req.session.aviso = { tipo: 'error', texto: 'No se puede borrar: esa membresía ya fue renovada.' };
    } else {
      await m.destroy(); // sus asistencias se borran en cascada
      req.session.aviso = { tipo: 'ok', texto: `Membresía ${m.codigo} borrada.` };
    }
    res.redirect('/membresias');
  } catch (err) { next(err); }
});

// ---------- Renovar ----------
// Solo si está vencida o vence en 7 días o menos. Crea una membresía NUEVA que empieza
// el día después del vencimiento (o hoy si ya venció): así queda el historial de pagos.
function datosRenovacion(m) {
  const h = hoy();
  const diaSiguiente = reglas.sumarDias(m.fecha_vencimiento, 1);
  return { h, inicio: diaSiguiente > h ? diaSiguiente : h, sePuede: m.fecha_vencimiento <= reglas.sumarDias(h, reglas.DIAS_POR_VENCER) };
}

router.get('/:id/renovar', requierePermiso('CREAR'), async (req, res, next) => {
  try {
    const m = await buscar(req.params.id);
    if (!m) return next();
    const r = datosRenovacion(m);
    res.render('membresias/renovar', { titulo: `Renovar ${m.codigo}`, m, inicio: fechaCR(r.inicio), vence: fechaCR(m.fecha_vencimiento), errores: [], datos: { plan: m.plan, monto: m.monto } });
  } catch (err) { next(err); }
});

router.post('/:id/renovar', requierePermiso('CREAR'), async (req, res, next) => {
  try {
    const m = await buscar(req.params.id);
    if (!m) return next();
    const r = datosRenovacion(m);
    const { datos, errores } = leerFormulario({ ...req.body, cliente_id: String(m.cliente_id), fecha_inicio: r.inicio });
    if (!r.sePuede) errores.unshift(`Solo se renueva una membresía vencida o que vence en ${reglas.DIAS_POR_VENCER} días o menos.`);
    if (!errores.length) {
      const g = await guardar(datos, { renovadaDe: m.id, usuarioId: req.usuario.id });
      if (!g.error) {
        req.session.aviso = { tipo: 'ok', texto: `Renovada: nueva membresía ${g.codigo}, vence el ${fechaCR(g.vence)}.` };
        return res.redirect('/membresias');
      }
      errores.push(g.error);
    }
    res.status(400).render('membresias/renovar', { titulo: `Renovar ${m.codigo}`, m, inicio: fechaCR(r.inicio), vence: fechaCR(m.fecha_vencimiento), errores, datos });
  } catch (err) { next(err); }
});

module.exports = router;