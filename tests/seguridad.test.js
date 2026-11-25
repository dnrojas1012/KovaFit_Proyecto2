// Suite de pruebas automatizadas de seguridad (UTN-10) - Kova Fit
// Un solo comando:  npm test   ->  reporte XML en reportes/resultados.xml
// Cada prueba manda un ataque y revisa que el sistema lo rechace.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Cliente, conSesion } = require('./ayuda');

describe('SQL Injection (UTN-07a)', () => {
  test("TC-01 Login con ' OR '1'='1 es rechazado", async () => {
    const c = new Cliente();
    const r = await c.login("' OR '1'='1", "' OR '1'='1");
    assert.equal(r.status, 401);                                   // no entra (no hay redirección al inicio)
    assert.match(await r.text(), /Usuario o contraseña incorrectos/);
  });

  test("TC-02 Login con admin'-- (comentario SQL) es rechazado", async () => {
    const c = new Cliente();
    const r = await c.login("admin'--", 'cualquiera');
    assert.equal(r.status, 401);
  });

  test('TC-03 Búsqueda con UNION SELECT no expone datos', async () => {
    const c = await conSesion('auditor');
    const ataque = "' UNION SELECT username, password_hash FROM usuarios --";
    const r = await c.pedir('/membresias?q=' + encodeURIComponent(ataque));
    assert.equal(r.status, 200);                                   // sin error 500
    const html = await r.text();
    assert.ok(!html.includes('$argon2'), 'se expuso un hash de contraseña');
    assert.match(html, /\(0\)/);                                   // 0 resultados
  });
});

describe('XSS (UTN-07b)', () => {
  test('TC-04 XSS reflejado: <script> en la búsqueda se muestra como texto', async () => {
    const c = await conSesion('auditor');
    const r = await c.pedir('/membresias?q=' + encodeURIComponent('<script>alert(1)</script>'));
    const html = await r.text();
    assert.ok(!html.includes('<script>alert(1)</script>'), 'el script llegó sin escapar');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('TC-05 XSS almacenado: <img onerror> guardado en un cliente se muestra como texto', async () => {
    const c = await conSesion('recepcion');
    const r = await c.enviar('/clientes', {
      cedula: 'X-' + Date.now().toString().slice(-8),
      nombre: '<img src=x onerror=alert(1)>',
      telefono: '8888-0000',
      emergencia_nombre: 'Prueba XSS',
      emergencia_telefono: '8888-0001',
    });
    assert.equal(r.status, 302);                                   // se guardó
    const html = await (await c.pedir('/clientes')).text();
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'la etiqueta <img> llegó sin escapar');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  });
});

describe('Control de acceso 403 (UTN-05, UTN-06, UTN-09)', () => {
  test('TC-06 Auditor entra directo a /roles: 403 con mensaje claro y sin trazas', async () => {
    const c = await conSesion('auditor');
    const r = await c.pedir('/roles');
    assert.equal(r.status, 403);
    const html = await r.text();
    assert.match(html, /Acceso denegado/);
    assert.ok(!/at .*\.js:\d+/.test(html) && !html.includes('node_modules'), 'se mostró una traza');
  });

  test('TC-07 Recepción manda a mano la orden de borrar un usuario: 403', async () => {
    const c = await conSesion('recepcion');
    const r = await c.enviar('/usuarios/2/eliminar', {});          // con token válido: se prueba el permiso
    assert.equal(r.status, 403);
  });

  test('TC-08 Auditor no puede vender una membresía (no tiene permiso Crear)', async () => {
    const c = await conSesion('auditor');
    const r = await c.enviar('/membresias', { cliente_id: '1', plan: 'MENSUAL', fecha_inicio: '2027-01-01', monto: '25000' });
    assert.equal(r.status, 403);
  });

  test('TC-09 El 403 de Recepción en /bitacora queda registrado en la bitácora', async () => {
    const recepcion = await conSesion('recepcion');
    assert.equal((await recepcion.pedir('/bitacora')).status, 403);
    const admin = await conSesion('admin');
    const html = await (await admin.pedir('/bitacora?evento=ACCESO_DENEGADO')).text();
    assert.match(html, /ACCESO_DENEGADO/);
    assert.match(html, /\/bitacora/);
  });

  test('TC-10 Auditor no ve el contacto de emergencia (dato sensible)', async () => {
    const c = await conSesion('auditor');
    const html = await (await c.pedir('/clientes')).text();
    assert.ok(!html.includes('8800-1001'), 'se mostró el teléfono de emergencia');
    assert.match(html, /\*\*\*\*/);                                // cédulas enmascaradas
  });
});

describe('CSRF (UTN-07d)', () => {
  test('TC-11 Formulario sin token o con token falso es rechazado', async () => {
    const c = await conSesion('recepcion');
    const sinToken = await c.enviar('/asistencia', { cedula: '2-0705-0505' }, { conToken: false });
    assert.equal(sinToken.status, 403);
    const falso = await c.enviar('/asistencia', { cedula: '2-0705-0505' }, { token: 'token-inventado' });
    assert.equal(falso.status, 403);
  });
});

describe('Sesión (UTN-07c)', () => {
  test('TC-12 Sin sesión, toda ruta privada redirige al login y se notifica', async () => {
    const c = new Cliente();
    for (const ruta of ['/', '/clientes', '/membresias', '/usuarios', '/roles', '/bitacora']) {
      const r = await c.pedir(ruta);
      assert.equal(r.status, 302, ruta);
      assert.match(r.headers.get('location'), /\/login/, ruta);
    }
    assert.match(await (await c.pedir('/login?requiere=1')).text(), /Debe iniciar sesión/);
  });

  test('TC-13 La cookie de sesión es HttpOnly, SameSite=Strict y no lleva datos del usuario', async () => {
    const c = new Cliente();
    await c.pedir('/login');                                       // obtiene token y cookie
    const token = await c.token('/login');
    const cuerpo = new URLSearchParams({ username: 'recepcion', password: 'Recepcion#Gym2026', _csrf: token });
    const r = await c.pedir('/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: cuerpo.toString() });
    const setCookie = r.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.ok(!/recepcion|rol/i.test(decodeURIComponent(setCookie.split(';')[0])), 'la cookie lleva datos del usuario');
  });

  test('TC-14 La sesión se cierra tras más de 60 s sin actividad', { timeout: 90_000 }, async () => {
    const c = await conSesion('recepcion');
    assert.equal((await c.pedir('/')).status, 200);                 // última actividad
    await new Promise((listo) => setTimeout(listo, 62_000));        // 62 s sin peticiones
    const r = await c.pedir('/membresias');
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /\/login\?expirada=1/);
  });
});

describe('Encabezados HTTP (UTN-08)', () => {
  test('TC-15 La respuesta trae CSP, X-Frame-Options y nosniff, y no revela la tecnología', async () => {
    const r = await new Cliente().pedir('/login');
    const csp = r.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
  });
});