// Todos los controles de seguridad del sistema en un solo lugar
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { csrfSync } = require('csrf-sync');
const { Usuario, Rol, Permiso } = require('./modelos');
const { registrar } = require('./bitacora');

const PRODUCCION = process.env.NODE_ENV === 'production';
const LIMITE_MS = (Number(process.env.SESSION_TIMEOUT_SECONDS) || 60) * 1000;
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET debe existir en .env y tener al menos 32 caracteres');
}

// ---------- 1. Encabezados HTTP  ----------
const encabezados = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
  strictTransportSecurity: PRODUCCION ? { maxAge: 31536000, includeSubDomains: true } : false,
});

// ---------- 2. Sesión de 60 s  ----------
// La sesión vive en la base, la cookie solo lleva un id aleatorio firmado.
const sesion = session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    tableName: 'session',
  }),
  name: 'kova.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // cada petición renueva los 60 s
  cookie: {
    httpOnly: true, // JavaScript no puede leerla
    secure: PRODUCCION, // solo por HTTPS en producción
    sameSite: 'strict', // no viaja desde otros sitios
    maxAge: LIMITE_MS,
  },
});

// Si pasaron más de 60 s sin actividad, la sesión se destruye
function inactividad(req, res, next) {
  if (!req.session || !req.session.usuarioId) return next();
  const ahora = Date.now();
  if (ahora - (req.session.ultimaActividad || ahora) > LIMITE_MS) {
    return req.session.destroy(() => {
      res.clearCookie('kova.sid');
      res.redirect('/login?expirada=1');
    });
  }
  req.session.ultimaActividad = ahora;
  next();
}

// ---------- 3. Token anti-CSRF ----------
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body && req.body._csrf,
});
function csrf(req, res, next) {
  csrfSynchronisedProtection(req, res, (err) => {
    if (err) return next(err);
    res.locals.csrfToken = generateToken(req);
    next();
  });
}

// ---------- 4. Usuario de la sesión con su rol y permisos ----------
async function cargarUsuario(req, res, next) {
  req.usuario = null;
  if (req.session && req.session.usuarioId) {
    const u = await Usuario.findByPk(req.session.usuarioId, {
      include: { model: Rol, as: 'rol', include: { model: Permiso, as: 'permisos' } },
    });
    if (u && u.activo) {
      req.usuario = {
        id: u.id, username: u.username, nombre: u.nombre,
        rol: u.rol.nombre, permisos: u.rol.permisos.map((p) => p.codigo),
      };
    }
  }
  res.locals.usuario = req.usuario;
  next();
}

// ---------- 5. Sin sesión: redirigir al login y avisar  ----------
function requiereSesion(req, res, next) {
  if (req.usuario) return next();
  const teniaCookie = (req.headers.cookie || '').includes('kova.sid=');
  res.redirect(teniaCookie ? '/login?expirada=1' : '/login?requiere=1');
}

// ---------- 6. Permisos y roles ----------
async function denegar(req, res, motivo) {
  await registrar(req, 'ACCESO_DENEGADO', motivo);// cada 403 queda en la bitácora
  res.status(403).render('error', { titulo: 'Acceso denegado', mensaje: 'No tiene permiso para realizar esta acción.' });
}
const requierePermiso = (codigo) => (req, res, next) =>
  (req.usuario.permisos.includes(codigo) ? next() : denegar(req, res, `Falta el permiso ${codigo}`));
const soloSuperAdmin = (req, res, next) =>
  (req.usuario.rol === 'SuperAdmin' ? next() : denegar(req, res, `El rol ${req.usuario.rol} no es SuperAdmin`));

module.exports = {
  LIMITE_MS, encabezados, sesion, inactividad, csrf,
  cargarUsuario, requiereSesion, requierePermiso, soloSuperAdmin, denegar,
};