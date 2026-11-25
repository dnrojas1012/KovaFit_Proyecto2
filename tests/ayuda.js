// Funciones de apoyo para las pruebas de seguridad.
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const USUARIOS = {
  admin: ['admin', 'Admin#Gym2026'],
  auditor: ['auditor', 'Auditor#Gym2026'],
  recepcion: ['recepcion', 'Recepcion#Gym2026'],
};

// Un "navegador mínimo": guarda la cookie de sesión y la manda en cada petición
class Cliente {
  constructor() { this.cookie = ''; }

  async pedir(ruta, opciones = {}) {
    const r = await fetch(BASE + ruta, {
      redirect: 'manual',                                  // queremos ver los 302
      ...opciones,
      headers: { ...(opciones.headers || {}), cookie: this.cookie },
    });
    const nueva = r.headers.get('set-cookie');
    if (nueva) this.cookie = nueva.split(';')[0];          // solo "kova.sid=..."
    return r;
  }

  // Lee el token anti-CSRF que la página publica en <meta name="csrf-token">
  async token(ruta = '/login') {
    const html = await (await this.pedir(ruta)).text();
    const m = html.match(/name="csrf-token" content="([^"]*)"/);
    return m ? m[1] : '';
  }

  // Envía un formulario (POST) con o sin token
  async enviar(ruta, datos, { conToken = true, token } = {}) {
    const cuerpo = new URLSearchParams(datos);
    if (conToken) cuerpo.set('_csrf', token || await this.token(ruta === '/login' ? '/login' : '/'));
    return this.pedir(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
    });
  }

  async login(usuario, clave) { return this.enviar('/login', { username: usuario, password: clave }); }
}

// Crea un cliente con la sesión iniciada como admin, auditor o recepcion
async function conSesion(quien) {
  const c = new Cliente();
  const r = await c.login(...USUARIOS[quien]);
  if (r.status !== 302) throw new Error(`No se pudo iniciar sesión como ${quien} (HTTP ${r.status})`);
  return c;
}

module.exports = { BASE, Cliente, conSesion };