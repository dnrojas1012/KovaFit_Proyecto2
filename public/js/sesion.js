// Comportamiento del navegador. Es un archivo externo porque la CSP prohíbe scripts dentro del HTML. No usa innerHTML: solo cambia texto
(function () {
  // 1. Pedir confirmación antes de borrar: <form data-confirmar="¿Seguro?">
  document.querySelectorAll('form[data-confirmar]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirmar)) e.preventDefault();
    });
  });

  // 2. Cuenta regresiva de la sesión (el cierre real lo hace el servidor)
  var segundos = Number(document.body.dataset.timeout);
  if (!segundos) return;
  var contador = document.getElementById('contador');
  var aviso = document.getElementById('aviso-sesion');
  var restante = segundos;
  setInterval(function () {
    restante -= 1;
    if (contador) contador.textContent = Math.max(restante, 0);
    if (aviso) aviso.hidden = restante > 15;
    if (restante <= -1) window.location.href = '/login?expirada=1';
  }, 1000);
})();