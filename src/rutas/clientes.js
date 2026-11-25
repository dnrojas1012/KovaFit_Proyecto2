//Registro de clientes (crear, ver, editar y borrar)
// Dato sensible: teléfono y contacto de emergencia. Solo los ve quien tiene el permiso EDITAR.
const express = require('express');
const { Op } = require('sequelize');
const { Cliente, Membresia } = require('../modelos');
const { requierePermiso } = require('../seguridad');
const v = require('../validacion');

const router = express.Router();

const veDatosSensibles = (usuario) => usuario.permisos.includes('EDITAR');
const enmascarar = (cedula) => cedula.slice(0, 2) + cedula.slice(2, -2).replace(/[0-9A-Za-z]/g, '*') + cedula.slice(-2);

function leerFormulario(body) {
  const datos = {
    cedula: v.texto(body.cedula),
    nombre: v.texto(body.nombre),
    telefono: v.texto(body.telefono),
    emergencia_nombre: v.texto(body.emergencia_nombre),
    emergencia_telefono: v.texto(body.emergencia_telefono),
  };
  const errores = [];
  v.validarCampo(errores, 'cédula', datos.cedula, v.patrones.cedula, 'La cédula debe tener de 5 a 20 números, letras o guiones.');
  v.validarNombre(errores, datos.nombre);
  v.validarCampo(errores, 'teléfono', datos.telefono, v.patrones.telefono, 'El teléfono debe tener de 8 a 20 dígitos.');
  v.validarNombre(errores, datos.emergencia_nombre, 'contacto de emergencia');
  v.validarCampo(errores, 'teléfono de emergencia', datos.emergencia_telefono, v.patrones.telefono, 'El teléfono de emergencia debe tener de 8 a 20 dígitos.');
  return { datos, errores };
}

const vacio = { cedula: '', nombre: '', telefono: '', emergencia_nombre: '', emergencia_telefono: '' };
const formulario = (res, estado, datos) => res.status(estado.errores.length ? 400 : 200)
  .render('clientes/form', { titulo: estado.id ? 'Editar cliente' : 'Nuevo cliente', ...estado, datos });

// ---------- Lista y búsqueda ----------
router.get('/', async (req, res, next) => {
  try {
    const q = v.texto(req.query.q).slice(0, 50);
    const where = q ? { [Op.or]: [{ nombre: { [Op.iLike]: `%${q}%` } }, { cedula: { [Op.iLike]: `%${q}%` } }] } : {};
    const filas = await Cliente.findAll({ where, order: [['nombre', 'ASC']], include: { model: Membresia, as: 'membresias', attributes: ['fecha_vencimiento'] } });
    const sensibles = veDatosSensibles(req.usuario);
    const clientes = filas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      cedula: sensibles ? c.cedula : enmascarar(c.cedula),
      telefono: sensibles ? c.telefono : null,
      emergencia: sensibles ? `${c.emergencia_nombre} · ${c.emergencia_telefono}` : null,
      vence: c.membresias.map((m) => m.fecha_vencimiento).sort().pop() || null,
    }));
    res.render('clientes/lista', { titulo: 'Clientes', clientes, sensibles, q });
  } catch (err) { next(err); }
});

// ---------- Crear ----------
router.get('/nuevo', requierePermiso('CREAR'), (req, res) => formulario(res, { errores: [] }, vacio));

router.post('/', requierePermiso('CREAR'), async (req, res, next) => {
  try {
    const { datos, errores } = leerFormulario(req.body);
    if (!errores.length) {
      if (await Cliente.findOne({ where: { cedula: datos.cedula } })) errores.push('Ya existe un cliente con esa cédula.');
      else {
        await Cliente.create(datos);
        req.session.aviso = { tipo: 'ok', texto: `Cliente ${datos.nombre} registrado.` };
        return res.redirect('/clientes');
      }
    }
    formulario(res, { errores }, datos);
  } catch (err) { next(err); }
});

// ---------- Editar ----------
router.get('/:id/editar', requierePermiso('EDITAR'), async (req, res, next) => {
  try {
    const cliente = await Cliente.findByPk(v.entero(req.params.id) || 0);
    if (!cliente) return next();
    formulario(res, { id: cliente.id, errores: [] }, cliente.get());
  } catch (err) { next(err); }
});

router.post('/:id', requierePermiso('EDITAR'), async (req, res, next) => {
  try {
    const cliente = await Cliente.findByPk(v.entero(req.params.id) || 0);
    if (!cliente) return next();
    const { datos, errores } = leerFormulario(req.body);
    if (!errores.length) {
      const otro = await Cliente.findOne({ where: { cedula: datos.cedula, id: { [Op.ne]: cliente.id } } });
      if (otro) errores.push('Ya existe un cliente con esa cédula.');
      else {
        await cliente.update(datos);
        req.session.aviso = { tipo: 'ok', texto: 'Cambios guardados.' };
        return res.redirect('/clientes');
      }
    }
    formulario(res, { id: cliente.id, errores }, datos);
  } catch (err) { next(err); }
});

// ---------- Borrar ----------
router.post('/:id/eliminar', requierePermiso('BORRAR'), async (req, res, next) => {
  try {
    const cliente = await Cliente.findByPk(v.entero(req.params.id) || 0);
    if (!cliente) return next();
    if (await Membresia.count({ where: { cliente_id: cliente.id } })) {
      req.session.aviso = { tipo: 'error', texto: 'No se puede borrar: el cliente tiene membresías registradas.' };
    } else {
      await cliente.destroy();
      req.session.aviso = { tipo: 'ok', texto: 'Cliente borrado.' };
    }
    res.redirect('/clientes');
  } catch (err) { next(err); }
});

module.exports = router;