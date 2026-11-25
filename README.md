# Kova Fit · Control y confianza

Sistema web seguro para la gestión de un gimnasio y sus membresías.
Proyecto 2 de ISW-622 Pruebas de Software, Universidad Técnica Nacional, Sede San Carlos.

**Integrantes:** Daniela Rojas Chaves y Brandon Prado Mora.

## Tecnología (toda gratuita)

| Parte | Herramienta | Por qué |
|---|---|---|
| Servidor | Node.js + Express | Liviano y visto en clase |
| Base de datos | PostgreSQL | Relacional (UTN-01) |
| ORM | Sequelize | Consultas parametrizadas: previene SQL Injection (UTN-07a) |
| Pantallas | EJS | Escapa el HTML automáticamente: previene XSS (UTN-07b) |
| Contraseñas | argon2 (Argon2id) | Hash seguro (UTN-02) |
| Sesión | express-session + connect-pg-simple | Cookie HttpOnly, cierre a los 60 s (UTN-07c) |
| CSRF | csrf-sync | Token en cada formulario (UTN-07d) |
| Encabezados | helmet | CSP, X-Frame-Options, nosniff, HSTS (UTN-08) |
| Pruebas | node:test (incluido en Node) | 15 pruebas de seguridad con reporte JUnit XML (UTN-10) |

## Instalar y correr en su PC

Requisitos: Node.js 20 o superior y PostgreSQL.

1. `npm install`
2. Crear una base vacía (por ejemplo `kova_fit`) y ejecutar en ella `db/schema.sql` y luego `db/datos.sql`.
3. Copiar `.env.example` como `.env` y poner la clave de PostgreSQL y un `SESSION_SECRET` largo y aleatorio.
4. `npm start` y abrir http://localhost:3000

## Usuarios de prueba (datos ficticios)

| Usuario | Contraseña | Rol | Qué puede hacer |
|---|---|---|---|
| admin | Admin#Gym2026 | SuperAdmin | Todo, incluidos usuarios, roles, permisos y bitácora |
| recepcion | Recepcion#Gym2026 | Recepción | Clientes, membresías, asistencia y reporte |
| auditor | Auditor#Gym2026 | Auditor | Solo lectura; datos sensibles ocultos |

## Pruebas de seguridad (UTN-10)

Con la app corriendo en otra ventana:

```
npm test
```

Corre 15 pruebas (SQL Injection, XSS, control de acceso, CSRF, sesión y encabezados) y deja el reporte en `reporte-pruebas.xml`.

## Requisitos cubiertos

| Requisito | Dónde |
|---|---|
| UTN-01 Web + BD relacional | `db/schema.sql`, `src/db.js` |
| UTN-02 Argon2id | `src/rutas/auth.js`, `src/rutas/usuarios.js` |
| UTN-03 CRUD de Membresía | `src/rutas/membresias.js` |
| RFD-3.1 a 3.5, RN-3.1 a 3.3 | `clientes.js`, `membresias.js`, `asistencia.js`, `reportes.js`, `src/membresias.js`, CHECK y UNIQUE en `schema.sql` |
| UTN-04 Usuarios con identificación y último login | `src/rutas/usuarios.js` |
| UTN-05 Permisos por rol, 403 | `src/seguridad.js` (`requierePermiso`), `src/rutas/roles.js` |
| UTN-06 SuperAdmin, Auditor, Recepción | `db/datos.sql`, `soloSuperAdmin` |
| UTN-07a/b/c/d | Sequelize, EJS, sesión de 60 s, csrf-sync en `src/seguridad.js` |
| UTN-08 Encabezados | `helmet` en `src/seguridad.js` |
| UTN-09 Bitácora | `src/bitacora.js`, `src/rutas/bitacora.js` |
| UTN-10 Pruebas | `tests/` |