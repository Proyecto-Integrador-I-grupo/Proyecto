const viewFiles = {
  dashboard: 'views/dashboard.html',
  estudiantes: 'views/estudiantes.html',
  profesores: 'views/profesores.html',
  matricula: 'views/matricula.html',
  asistencia: 'views/asistencia.html',
  reportes: 'views/reportes.html',
  consultas: 'views/consultas.html',
  perfil: 'views/perfil.html',
  usuarios: 'views/usuarios.html'
};

async function loadViewModule(viewName) {
  const file = viewFiles[viewName];
  if (!file) return;

  const main = document.getElementById('content');
  if (!main) return;

  try {
    const res = await fetch(file);
    if (!res.ok) {
      console.error(`No fue posible cargar ${file}`);
      return;
    }

    const html = await res.text();
    main.insertAdjacentHTML('beforeend', html);
  } catch (error) {
    console.error(`Error al cargar ${file}:`, error);
  }
}

async function loadAllViews() {
  await Promise.all(Object.keys(viewFiles).map(loadViewModule));
  window.dispatchEvent(new CustomEvent('app:views-ready'));
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadAllViews();
});