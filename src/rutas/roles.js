// UTN-05 y UTN-06: roles y sus permisos (Crear, Editar, Borrar, Ver reportes).
// Los permisos se asignan al ROL, nunca al usuario. Solo el SuperAdmin entra aquí.
const express = require('express');
const { sequelize } = require('../db');
const { Rol, Permiso, Usuario } = require('../modelos');
const { soloSuperAdmin } = require('../seguridad');
const { registrar } = require('../bitacora');
const v = require('../validacion');

const router = express.Router();
router.use(soloSuperAdmin);                                  // todo el módulo: solo SuperAdmin

const permisos = () => Permiso.findAll({ order: [['id', 'ASC']] });
const marcados = (body) => [].concat(body.permisos || []).map(v.entero).filter(Boolean);

function leerFormulario(body) {
  const datos = { nombre: v.texto(body.nombre), descripcion: v.texto(body.descripcion).slice(0, 200) };
  const errores = [];
  v.validarCampo(errores, 'nombre', datos.nombre, v.patrones.nombreRol, 'El nombre del rol debe tener de 3 a 50 letras o números.');
  return { datos, ids: marcados(body), errores };
}

async function formulario(res, estado, extra) {
  res.status(estado).render('roles/form', { permisos: await permisos(), errores: [], ...extra });
}

router.get('/', async (req, res, next) => {
  try {
    const roles = await Rol.findAll({ include: [{ model: Permiso, as: 'permisos' }, { model: Usuario, attributes: ['id'] }], order: [['id', 'ASC']] });
    res.render('roles/lista', { titulo: 'Roles y permisos', roles, todos: await permisos() });
  } catch (err) { next(err); }
});

router.get('/nuevo', async (req, res, next) => {
  try { await formulario(res, 200, { titulo: 'Nuevo rol', datos: {}, ids: [] }); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { datos, ids, errores } = leerFormulario(req.body);
    if (!errores.length && await Rol.findOne({ where: { nombre: datos.nombre } })) errores.push('Ya existe un rol con ese nombre.');
    if (errores.length) return formulario(res, 400, { titulo: 'Nuevo rol', datos, ids, errores });
    await sequelize.transaction(async (t) => {
      const rol = await Rol.create(datos, { transaction: t });
      await rol.setPermisos(ids, { transaction: t });
    });
    await registrar(req, 'ROL_CREADO', `Rol ${datos.nombre} con permisos [${ids.join(', ')}]`);
    req.session.aviso = { tipo: 'ok', texto: `Rol ${datos.nombre} creado.` };
    res.redirect('/roles');
  } catch (err) { next(err); }
});

router.get('/:id/editar', async (req, res, next) => {
  try {
    const rol = await Rol.findByPk(v.entero(req.params.id) || 0, { include: [{ model: Permiso, as: 'permisos' }] });
    if (!rol) return next();
    await formulario(res, 200, { titulo: `Editar ${rol.nombre}`, id: rol.id, datos: rol, ids: rol.permisos.map((p) => p.id), sistema: rol.es_sistema });
  } catch (err) { next(err); }
});

router.post('/:id', async (req, res, next) => {
  try {
    const rol = await Rol.findByPk(v.entero(req.params.id) || 0);
    if (!rol) return next();
    const { datos, ids, errores } = leerFormulario(req.body);
    if (rol.es_sistema) datos.nombre = rol.nombre;          // los 3 roles base no cambian de nombre
    if (rol.nombre === 'SuperAdmin') errores.push('Los permisos del SuperAdmin no se pueden quitar.');
    if (errores.length) return formulario(res, 400, { titulo: `Editar ${rol.nombre}`, id: rol.id, datos, ids, errores, sistema: rol.es_sistema });
    await sequelize.transaction(async (t) => {
      await rol.update(datos, { transaction: t });
      await rol.setPermisos(ids, { transaction: t });
    });
    await registrar(req, 'CAMBIO_PERMISOS', `Rol ${rol.nombre} ahora tiene permisos [${ids.join(', ')}]`);
    req.session.aviso = { tipo: 'ok', texto: `Permisos del rol ${rol.nombre} actualizados.` };
    res.redirect('/roles');
  } catch (err) { next(err); }
});

router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const rol = await Rol.findByPk(v.entero(req.params.id) || 0);
    if (!rol) return next();
    const enUso = await Usuario.count({ where: { rol_id: rol.id } });
    if (rol.es_sistema || enUso) {
      req.session.aviso = { tipo: 'error', texto: rol.es_sistema ? 'Los roles base no se pueden borrar.' : 'El rol tiene usuarios asignados. Cámbielos de rol primero.' };
      return res.redirect('/roles');
    }
    await rol.destroy();
    await registrar(req, 'ROL_BORRADO', `Rol ${rol.nombre}`);
    req.session.aviso = { tipo: 'ok', texto: `Rol ${rol.nombre} borrado.` };
    res.redirect('/roles');
  } catch (err) { next(err); }
});

module.exports = router;