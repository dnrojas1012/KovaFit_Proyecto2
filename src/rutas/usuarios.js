// UTN-04 Gestión de usuarios: lista con identificación, rol, permisos y último login.
// Ver: cualquier usuario con sesión. Crear, editar y borrar: solo SuperAdmin (UTN-06).
// UTN-02: la contraseña se guarda como hash Argon2id, nunca en texto plano.
const express = require('express');
const argon2 = require('argon2');
const { Op } = require('sequelize');
const { Usuario, Rol, Permiso } = require('../modelos');
const { soloSuperAdmin } = require('../seguridad');
const { registrar } = require('../bitacora');
const v = require('../validacion');

const router = express.Router();

const roles = () => Rol.findAll({ order: [['id', 'ASC']] });
const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short' }) : 'Nunca');

function leerFormulario(body, esNuevo) {
  const datos = {
    username: v.texto(body.username),
    identificacion: v.texto(body.identificacion),
    nombre: v.texto(body.nombre),
    correo: v.texto(body.correo).toLowerCase(),
    rol_id: v.entero(body.rol_id),
    activo: body.activo === 'on',
  };
  const password = typeof body.password === 'string' ? body.password : '';
  const errores = [];
  v.validarCampo(errores, 'usuario', datos.username, v.patrones.username, 'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo.');
  v.validarCampo(errores, 'identificación', datos.identificacion, v.patrones.identificacion, 'La identificación debe tener de 5 a 20 números, letras o guiones.');
  v.validarNombre(errores, datos.nombre);
  v.validarCampo(errores, 'correo', datos.correo, v.patrones.correo, 'El correo no es válido.');
  if (!datos.rol_id) errores.push('Seleccione un rol.');
  if (esNuevo || password) v.validarPassword(errores, password);   // al editar, vacío = no cambiar
  return { datos, password, errores };
}

async function formulario(res, estado, extra) {
  res.status(estado).render('usuarios/form', { roles: await roles(), errores: [], ...extra });
}

// Mensaje claro si se repite usuario, identificación o correo
async function repetido(datos, excluirId) {
  const otro = await Usuario.findOne({
    where: {
      [Op.or]: [{ username: datos.username }, { identificacion: datos.identificacion }, { correo: datos.correo }],
      ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}),
    },
  });
  if (!otro) return null;
  if (otro.username === datos.username) return 'Ese nombre de usuario ya existe.';
  if (otro.identificacion === datos.identificacion) return 'Esa identificación ya está registrada.';
  return 'Ese correo ya está registrado.';
}

router.get('/', async (req, res, next) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password_hash'] },          // el hash nunca sale de la base
      include: [{ model: Rol, as: 'rol', include: [{ model: Permiso, as: 'permisos' }] }],
      order: [['username', 'ASC']],
    });
    res.render('usuarios/lista', { titulo: 'Usuarios', usuarios, fechaHora });
  } catch (err) { next(err); }
});

router.get('/nuevo', soloSuperAdmin, async (req, res, next) => {
  try { await formulario(res, 200, { titulo: 'Nuevo usuario', datos: { activo: true } }); } catch (err) { next(err); }
});

router.post('/', soloSuperAdmin, async (req, res, next) => {
  try {
    const { datos, password, errores } = leerFormulario(req.body, true);
    if (!errores.length) { const r = await repetido(datos); if (r) errores.push(r); }
    if (errores.length) return formulario(res, 400, { titulo: 'Nuevo usuario', datos, errores });
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const u = await Usuario.create({ ...datos, password_hash });
    await registrar(req, 'USUARIO_CREADO', `Usuario ${u.username} (rol ${datos.rol_id})`);
    req.session.aviso = { tipo: 'ok', texto: `Usuario ${u.username} creado.` };
    res.redirect('/usuarios');
  } catch (err) { next(err); }
});

router.get('/:id/editar', soloSuperAdmin, async (req, res, next) => {
  try {
    const u = await Usuario.findByPk(v.entero(req.params.id) || 0);
    if (!u) return next();
    await formulario(res, 200, { titulo: `Editar ${u.username}`, id: u.id, datos: u.get({ plain: true }) });
  } catch (err) { next(err); }
});

router.post('/:id', soloSuperAdmin, async (req, res, next) => {
  try {
    const u = await Usuario.findByPk(v.entero(req.params.id) || 0);
    if (!u) return next();
    const { datos, password, errores } = leerFormulario(req.body, false);
    if (u.id === req.usuario.id && (!datos.activo || datos.rol_id !== u.rol_id)) errores.push('No puede desactivarse ni cambiarse el rol a sí mismo.');
    if (!errores.length) { const r = await repetido(datos, u.id); if (r) errores.push(r); }
    if (errores.length) return formulario(res, 400, { titulo: `Editar ${u.username}`, id: u.id, datos, errores });
    const cambioRol = datos.rol_id !== u.rol_id;
    if (password) datos.password_hash = await argon2.hash(password, { type: argon2.argon2id });
    await u.update(datos);
    await registrar(req, cambioRol ? 'CAMBIO_ROL' : 'USUARIO_EDITADO', `Usuario ${u.username}${cambioRol ? ` ahora tiene el rol ${datos.rol_id}` : ''}${password ? ' (contraseña cambiada)' : ''}`);
    req.session.aviso = { tipo: 'ok', texto: `Usuario ${u.username} actualizado.` };
    res.redirect('/usuarios');
  } catch (err) { next(err); }
});

router.post('/:id/eliminar', soloSuperAdmin, async (req, res, next) => {
  try {
    const u = await Usuario.findByPk(v.entero(req.params.id) || 0);
    if (!u) return next();
    if (u.id === req.usuario.id) {
      req.session.aviso = { tipo: 'error', texto: 'No puede borrar su propio usuario.' };
      return res.redirect('/usuarios');
    }
    await u.destroy();
    await registrar(req, 'USUARIO_BORRADO', `Usuario ${u.username}`);
    req.session.aviso = { tipo: 'ok', texto: `Usuario ${u.username} borrado.` };
    res.redirect('/usuarios');
  } catch (err) { next(err); }
});

module.exports = router;