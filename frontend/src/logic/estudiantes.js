import {
  apiFetch,
  currentUser,
  showResultModal,
  showToast
} from './ui.js';

import {
  refreshDashboardCounts
} from './dashboard.js';

(function () {
  const moduleName = 'estudiantes';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireEstudiantesEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE ESTUDIANTES (PERSONAS)
   Pre-registro de estudiantes: alta, edición, búsqueda y baja lógica.
   ========================================== */

let allPersonas = [];
let personaTableBody = null;
let estudiantePendienteId = null;

function wireEstudiantesEvents() {
  personaTableBody = document.querySelector('#personas-table tbody');
  const personaForm = document.getElementById('persona-form');

  if (personaForm && !personaForm.dataset.wired) {
    personaForm.dataset.wired = '1';
    personaForm.addEventListener('submit', handlePersonaSubmit);
  }

  const searchInput = document.getElementById('persona-search');
  if (searchInput && !searchInput.dataset.wired) {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', () => renderPersonasTable(filterPersonas(searchInput.value)));
  }

  if (personaTableBody && !personaTableBody.dataset.wired) {
    personaTableBody.dataset.wired = '1';
    personaTableBody.addEventListener('click', handlePersonaTableClick);
  }

  const confirmarEliminarEstudianteBtn = document.getElementById('confirmar-eliminar-estudiante-btn');
  if (confirmarEliminarEstudianteBtn && !confirmarEliminarEstudianteBtn.dataset.wired) {
    confirmarEliminarEstudianteBtn.dataset.wired = '1';
    confirmarEliminarEstudianteBtn.addEventListener('click', async () => {
      bootstrap.Modal.getInstance(document.getElementById('modalEliminarEstudiante'))?.hide();
      await eliminarEstudiante(estudiantePendienteId);
    });
  }

  const modalEstudianteEl = document.getElementById('modalEstudiante');
  if (modalEstudianteEl && !modalEstudianteEl.dataset.wired) {
    modalEstudianteEl.dataset.wired = '1';
    modalEstudianteEl.addEventListener('hidden.bs.modal', resetPersonaForm);
  }
}

async function loadPersonas() {
  if (!personaTableBody) return;

  try {
    const res = await apiFetch('/api/estudiantes');
    if (!res.ok) throw new Error('No se pudo cargar la lista de estudiantes');
    allPersonas = await res.json();

    const searchInput = document.getElementById('persona-search');
    renderPersonasTable(filterPersonas(searchInput?.value || ''));
  } catch (error) {
    personaTableBody.innerHTML = '<tr><td colspan="6" class="text-muted text-center py-3">Error al obtener estudiantes del servidor.</td></tr>';
    showToast(error.message || 'Error cargando datos', 'error');
  }
}

function filterPersonas(term) {
  const q = (term || '').trim().toLowerCase();
  if (!q) return allPersonas;
  return allPersonas.filter((p) => {
    const texto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.toLowerCase();
    return texto.includes(q);
  });
}

function renderPersonasTable(personas) {
  if (!personaTableBody) return;
  personaTableBody.innerHTML = '';

  const esAdmin = (currentUser?.rol || '').toLowerCase() === 'administrador';

  if (!personas.length) {
    personaTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5">
          <i class="bi bi-people display-6 text-muted d-block mb-2"></i>
          <span class="text-muted">No hay estudiantes registrados todavía.</span>
        </td>
      </tr>
    `;
    return;
  }

  personas.forEach((p) => {
    const id = p.id_estudiante ?? p.id ?? '';
    const nombreCompleto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
    const nac = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '-';
    const ingreso = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : '-';
    const activo = p.estado == 1 || p.estado === undefined;

    const badgeEstado = activo
      ? '<span class="badge bg-success">Activo</span>'
      : '<span class="badge bg-secondary">Inactivo</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td>${nombreCompleto}</td>
      <td>${nac}</td>
      <td>${ingreso}</td>
      <td>${badgeEstado}</td>
      <td class="text-end">
        <button class="action-btn edit" data-id="${id}"><i class="bi bi-pencil"></i> Editar</button>
        ${esAdmin ? `<button class="action-btn del eliminar-estudiante-btn" data-id="${id}" data-nombre="${nombreCompleto}"><i class="bi bi-trash"></i> Eliminar</button>` : ''}
      </td>
    `;
    personaTableBody.appendChild(tr);
  });
}

function resetPersonaForm() {
  document.getElementById('persona-id').value = '';
  document.getElementById('nombre').value = '';
  document.getElementById('apellido1').value = '';
  document.getElementById('apellido2').value = '';
  document.getElementById('fecha_nacimiento').value = '';
  document.getElementById('genero').value = '';
  const ingresoEl = document.getElementById('persona-fecha-ingreso');
  if (ingresoEl) ingresoEl.value = '';
  const titleEl = document.getElementById('persona-form-title');
  if (titleEl) titleEl.textContent = 'Pre-registro de Estudiante';
  const submitEl = document.getElementById('persona-submit');
  if (submitEl) submitEl.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Estudiante';
}

async function handlePersonaSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('persona-id').value;
  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    apellido1: document.getElementById('apellido1').value.trim(),
    apellido2: document.getElementById('apellido2').value.trim(),
    fecha_nacimiento: document.getElementById('fecha_nacimiento').value || null,
    genero: document.getElementById('genero').value || null,
    fecha_ingreso: document.getElementById('persona-fecha-ingreso')?.value || null
  };

  try {
    const url = `/api/estudiantes${id ? `/${id}` : ''}`;
    const method = id ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    if (res.ok) {
      const modalEl = document.getElementById('modalEstudiante');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

      await loadPersonas();
      await refreshDashboardCounts();
      showResultModal(
        'success',
        id ? 'Estudiante actualizado' : 'Estudiante registrado',
        id ? 'Los datos del estudiante se actualizaron correctamente.' : 'El estudiante quedó pre-registrado. Recuerda procesar su matrícula cuando corresponda.'
      );
    } else {
      const json = await res.json().catch(() => ({}));
      showResultModal('error', 'No se pudo guardar', json.mensaje || json.error || 'No se pudo guardar la información del estudiante.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  }
}

async function handlePersonaTableClick(e) {
  const editButton = e.target.closest('.edit');
  const deleteButton = e.target.closest('.eliminar-estudiante-btn');

  if (editButton) {
    const id = editButton.dataset.id;
    try {
      const res = await apiFetch(`/api/estudiantes/${id}`);
      if (!res.ok) throw new Error();
      const p = await res.json();

      document.getElementById('persona-id').value = p.id_estudiante ?? p.id ?? '';
      document.getElementById('nombre').value = p.nombre ?? '';
      document.getElementById('apellido1').value = p.apellido1 ?? '';
      document.getElementById('apellido2').value = p.apellido2 ?? '';
      document.getElementById('fecha_nacimiento').value = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '';
      document.getElementById('genero').value = p.genero ?? '';
      const ingresoEl = document.getElementById('persona-fecha-ingreso');
      if (ingresoEl) ingresoEl.value = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : '';

      document.getElementById('persona-form-title').textContent = 'Editar Estudiante';
      const submitEl = document.getElementById('persona-submit');
      if (submitEl) submitEl.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Cambios';

      const modalEl = document.getElementById('modalEstudiante');
      if (modalEl) new bootstrap.Modal(modalEl).show();
    } catch {
      showResultModal('error', 'Error', 'No se pudo obtener la información del estudiante.');
    }
  }

  if (deleteButton) {
    estudiantePendienteId = deleteButton.dataset.id;
    const nombreEl = document.getElementById('eliminar-nombre-estudiante');
    if (nombreEl) nombreEl.textContent = deleteButton.dataset.nombre || '';

    const modalEl = document.getElementById('modalEliminarEstudiante');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }
}

async function eliminarEstudiante(id) {
  if (!id) return;
  try {
    const res = await apiFetch(`/api/estudiantes/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showResultModal('success', 'Estudiante eliminado', 'El estudiante fue marcado como inactivo y ya no aparece en el listado.');
      await loadPersonas();
      await refreshDashboardCounts();
    } else {
      showResultModal('error', 'No se pudo eliminar', json.error || 'Ocurrió un error al eliminar el estudiante.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    estudiantePendienteId = null;
  }
}