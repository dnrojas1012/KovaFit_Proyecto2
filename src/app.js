// Arma la aplicación. Cada petición pasa por estos pasos en orden.
const path = require('path');
const express = require('express');
const seg = require('./seguridad');
const { registrar } = require('./bitacora');

const app = express();
app.disable('x-powered-by');// no anunciar que es Express
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(seg.encabezados);// 1. Encabezados
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use((req, res, next) => { //valores para todas las pantallas
  res.locals.usuario = null;
  res.locals.csrfToken = '';
  res.locals.ruta = req.path;
  res.locals.segundos = seg.LIMITE_MS / 1000;
  next();
});
app.use(seg.sesion);  // 2. Sesión 
app.use(seg.inactividad); //cierre a los 60 s
app.use(seg.csrf); // 3. Token anti-CSRF
app.use(seg.cargarUsuario); // 4. ¿Quién es y qué puede hacer?
app.use((req, res, next) => {   // mensaje de "guardado", "borrado"...
  if (req.session) { res.locals.aviso = req.session.aviso || null; delete req.session.aviso; }
  next();
});

app.use(require('./rutas/auth'));  // login y logout: lo único público
app.use(seg.requiereSesion);  // 5. De aquí en adelante, todo exige sesión
app.use('/', require('./rutas/inicio'));
app.use('/clientes', require('./rutas/clientes'));
app.use('/membresias', require('./rutas/membresias'));
// RUTAS-SIGUIENTES

// Página no encontrada y errores
app.use((req, res) => res.status(404).render('error', { titulo: 'Página no encontrada', mensaje: 'La página que busca no existe.' }));
app.use(async (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.code === 'EBADCSRFTOKEN') {
    await registrar(req, 'CSRF_RECHAZADO', `${req.method} ${req.originalUrl}`);
    return res.status(403).render('error', { titulo: 'Solicitud rechazada', mensaje: 'El formulario expiró o no es válido. Vuelva a intentarlo.' });
  }
  console.error(err);
  res.status(500).render('error', { titulo: 'Algo salió mal', mensaje: 'Ocurrió un error inesperado. Intente de nuevo.' });
});

module.exports = app;