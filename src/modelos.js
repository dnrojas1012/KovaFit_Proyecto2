// Modelos del ORM: cada uno representa una tabla de db/schema.sql
const { DataTypes } = require('sequelize');
const { sequelize } = require('./db');

const comun = { timestamps: false, underscored: true };

// ---------- Seguridad ----------
const Rol = sequelize.define('Rol', {
  nombre: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(200), defaultValue: '' },
  es_sistema: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { ...comun, tableName: 'roles' });

const Permiso = sequelize.define('Permiso', {
  codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(60), allowNull: false },
}, { ...comun, tableName: 'permisos' });

// Los permisos se asignan a ROLES (UTN-05)
const RolPermiso = sequelize.define('RolPermiso', {}, { ...comun, tableName: 'rol_permiso' });
Rol.belongsToMany(Permiso, { through: RolPermiso, foreignKey: 'rol_id', otherKey: 'permiso_id', as: 'permisos' });
Permiso.belongsToMany(Rol, { through: RolPermiso, foreignKey: 'permiso_id', otherKey: 'rol_id' });

const Usuario = sequelize.define('Usuario', {
  username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  identificacion: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  correo: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false }, // Argon2id (UTN-02)
  activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  ultimo_login: { type: DataTypes.DATE },
}, { ...comun, tableName: 'usuarios' });
Usuario.belongsTo(Rol, { foreignKey: 'rol_id', as: 'rol' });
Rol.hasMany(Usuario, { foreignKey: 'rol_id' });

const Bitacora = sequelize.define('Bitacora', {
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  evento: { type: DataTypes.STRING(40), allowNull: false },
  usuario_id: { type: DataTypes.INTEGER },
  username: { type: DataTypes.STRING(30) },
  ip: { type: DataTypes.STRING(64) },
  ruta: { type: DataTypes.STRING(255) },
  detalle: { type: DataTypes.STRING(500) },
}, { ...comun, tableName: 'bitacora' });

// ---------- Gimnasio ----------
const Cliente = sequelize.define('Cliente', {
  cedula: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  telefono: { type: DataTypes.STRING(20), allowNull: false },
  emergencia_nombre: { type: DataTypes.STRING(100), allowNull: false },
  emergencia_telefono: { type: DataTypes.STRING(20), allowNull: false },
}, { ...comun, tableName: 'clientes' });

const Membresia = sequelize.define('Membresia', {
  codigo: { type: DataTypes.STRING(20) },              // lo genera la base: MEM-1000...
  plan: { type: DataTypes.STRING(12), allowNull: false },
  fecha_inicio: { type: DataTypes.DATEONLY, allowNull: false },
  fecha_vencimiento: { type: DataTypes.DATEONLY, allowNull: false },
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  renovada_de: { type: DataTypes.INTEGER },
  creado_por: { type: DataTypes.INTEGER },
}, { ...comun, tableName: 'membresias' });
Membresia.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(Membresia, { foreignKey: 'cliente_id', as: 'membresias' });

const Asistencia = sequelize.define('Asistencia', {
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  hora: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  registrado_por: { type: DataTypes.INTEGER },
}, { ...comun, tableName: 'asistencias' });
Asistencia.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Asistencia.belongsTo(Membresia, { foreignKey: 'membresia_id', as: 'membresia' });

module.exports = { Rol, Permiso, RolPermiso, Usuario, Bitacora, Cliente, Membresia, Asistencia };