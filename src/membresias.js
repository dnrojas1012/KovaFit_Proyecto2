// Reglas de negocio de las membresías
const { Op } = require('sequelize');
const { Membresia } = require('./modelos');

const PLANES = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 }; // meses de cada plan
const DIAS_POR_VENCER = 7;

const aFecha = (texto) => { const [a, m, d] = texto.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

function sumarDias(texto, dias) {
  const f = aFecha(texto);
  f.setUTCDate(f.getUTCDate() + dias);
  return aTexto(f);
}

function calcularVencimiento(inicio, plan) {
  const f = aFecha(inicio);
  const destino = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + PLANES[plan], 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(f.getUTCDate(), ultimoDia));
  return sumarDias(aTexto(destino), -1);
}

// busca otra membresía del mismo cliente cuyo periodo se cruce con el nuevo
function buscarTraslape(clienteId, inicio, vence, excluirId = null) {
  const where = { cliente_id: clienteId, fecha_inicio: { [Op.lte]: vence }, fecha_vencimiento: { [Op.gte]: inicio } };
  if (excluirId) where.id = { [Op.ne]: excluirId };
  return Membresia.findOne({ where });
}

function estado(m, h) {
  if (h < m.fecha_inicio) return 'Futura';
  if (h > m.fecha_vencimiento) return 'Vencida';
  if (m.fecha_vencimiento <= sumarDias(h, DIAS_POR_VENCER)) return 'Por vencer';
  return 'Vigente';
}

module.exports = { PLANES, DIAS_POR_VENCER, sumarDias, calcularVencimiento, buscarTraslape, estado };