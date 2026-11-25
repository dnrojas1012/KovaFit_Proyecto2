DROP TABLE IF EXISTS asistencias, membresias, clientes, bitacora, usuarios, rol_permiso, permisos, roles, session CASCADE;
DROP SEQUENCE IF EXISTS membresias_codigo_seq;

-- Roles y permisos: los permisos van al ROL, no al usuario
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200) NOT NULL DEFAULT '',
    es_sistema BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE permisos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(60) NOT NULL
);
CREATE TABLE rol_permiso (
    rol_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id INT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

-- Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    identificacion VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(120) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL REFERENCES roles(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login TIMESTAMPTZ,
    creado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Bitacora
CREATE TABLE bitacora (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evento VARCHAR(40) NOT NULL,
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    username VARCHAR(30),
    ip VARCHAR(64),
    ruta VARCHAR(255),
    detalle VARCHAR(500)
);

-- Gimnasio
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    emergencia_nombre VARCHAR(100) NOT NULL,
    emergencia_telefono VARCHAR(20) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE membresias_codigo_seq START 1000;
CREATE TABLE membresias (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE DEFAULT ('MEM-' || nextval('membresias_codigo_seq')),
    cliente_id INT NOT NULL REFERENCES clientes(id),
    plan VARCHAR(12) NOT NULL CHECK (plan IN ('MENSUAL','TRIMESTRAL','ANUAL')),
    fecha_inicio DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    renovada_de INT REFERENCES membresias(id),
    creado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_vencimiento >= fecha_inicio)
);

CREATE TABLE asistencias (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    membresia_id INT NOT NULL REFERENCES membresias(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registrado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT uq_asistencia_cliente_dia UNIQUE (cliente_id, fecha)
);

-- Aqui se guardan las sesiones de 60s
CREATE TABLE session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);