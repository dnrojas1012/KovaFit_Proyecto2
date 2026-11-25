// Registra eventos de auditoria
const { Bitacora } = require('./modelos');

async function registrar(req, evento, detalle = '', usuario = req.usuario) {
  try {
    await Bitacora.create({
      evento,
      usuario_id: usuario ? usuario.id : null,
      username: usuario ? usuario.username : null,
      ip: req.ip,
      ruta: req.originalUrl.slice(0, 255),
      detalle: String(detalle).slice(0, 500),
    });
  } catch (err) {
    console.error('No se pudo escribir en la bitacora:', err.message); // nunca tumba la peticion
  }
}

module.exports = { registrar };