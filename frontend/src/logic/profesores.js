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
  const moduleName = 'profesores';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireProfesoresEvents();
    },
    load: loadProfesores
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE PROFESORES
   Alta, edición, destitución, reintegro y asignación de sustitutos.
   ========================================== */

let allProfesores = [];
let profesorPendienteId = null;
let profesorReintegrarId = null;
let profesorFiltroEstado = 'todos';
let profesorBusqueda = '';
const SCHOOL_EMAIL_DOMAIN = String(import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN || 'educontrol.com')
  .trim().toLowerCase().replace(/^@+/, '');
const isSchoolEmail = (email) => String(email || '').trim().toLowerCase().endsWith(`@${SCHOOL_EMAIL_DOMAIN}`);

function wireProfesoresEvents() {
  const modalProfesor = document.getElementById('modalProfesor');
  if (modalProfesor && !modalProfesor.dataset.cleanWired) {
    modalProfesor.dataset.cleanWired = '1';

    const limpiarCredencialesProfesor = () => {
      const correo = document.getElementById('prof-correo');
      const clave = document.getElementById('prof-contrasena');
      if (correo) {
        correo.value = '';
        correo.setAttribute('readonly', 'readonly');
      }
      if (clave) {
        clave.value = '';
        clave.type = 'password';
        clave.setAttribute('readonly', 'readonly');
      }
      const toggle = document.getElementById('toggle-prof-password');
      const icon = toggle?.querySelector('i');
      icon?.classList.add('bi-eye');
      icon?.classList.remove('bi-eye-slash');
    };

    const habilitarCredencialesProfesor = () => {
      const correo = document.getElementById('prof-correo');
      const clave = document.getElementById('prof-contrasena');
      if (correo) {
        correo.value = '';
        correo.removeAttribute('readonly');
      }
      if (clave) {
        clave.value = '';
        clave.removeAttribute('readonly');
      }
    };

    modalProfesor.addEventListener('show.bs.modal', () => {
      document.getElementById('profesor-form')?.reset();
      limpiarCredencialesProfesor();
    });

    modalProfesor.addEventListener('shown.bs.modal', () => {
      window.setTimeout(habilitarCredencialesProfesor, 80);
      window.setTimeout(() => {
        const correo = document.getElementById('prof-correo');
        const clave = document.getElementById('prof-contrasena');
        if (correo && !correo.matches(':focus')) correo.value = '';
        if (clave && !clave.matches(':focus')) clave.value = '';
      }, 350);
    });

    modalProfesor.addEventListener('hidden.bs.modal', () => {
      document.getElementById('profesor-form')?.reset();
      limpiarCredencialesProfesor();
    });
  }

  const profForm = document.getElementById('profesor-form');
  if (profForm && !profForm.dataset.wired) {
    profForm.dataset.wired = '1';
    profForm.addEventListener('submit', handleProfesorSubmit);
  }

  const editForm = document.getElementById('editar-profesor-form');
  if (editForm && !editForm.dataset.wired) {
    editForm.dataset.wired = '1';
    editForm.addEventListener('submit', guardarEdicionProfesor);
  }

  const toggleProfPassword = document.getElementById('toggle-prof-password');
  if (toggleProfPassword && !toggleProfPassword.dataset.wired) {
    toggleProfPassword.dataset.wired = '1';
    toggleProfPassword.addEventListener('click', () => {
      const input = document.getElementById('prof-contrasena');
      const icon = toggleProfPassword.querySelector('i');
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      icon?.classList.toggle('bi-eye', showing);
      icon?.classList.toggle('bi-eye-slash', !showing);
    });
  }

  const profTableBody = document.querySelector('#profesores-table tbody');
  if (profTableBody && !profTableBody.dataset.wired) {
    profTableBody.dataset.wired = '1';
    profTableBody.addEventListener('click', handleProfesorTableClick);
  }

  const profFiltroEstado = document.getElementById('prof-filtro-estado');
  if (profFiltroEstado && !profFiltroEstado.dataset.wired) {
    profFiltroEstado.dataset.wired = '1';
    profFiltroEstado.addEventListener('change', () => {
      profesorFiltroEstado = profFiltroEstado.value;
      renderProfesoresTable(filtrarProfesores(allProfesores));
    });
  }

  const profRefrescar = document.getElementById('prof-refrescar');
  if (profRefrescar && !profRefrescar.dataset.wired) {
    profRefrescar.dataset.wired = '1';
    profRefrescar.addEventListener('click', async () => {
      profRefrescar.disabled = true;
      profRefrescar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Actualizando...';
      try {
        await loadProfesores();
        showToast('Lista de profesores actualizada.', 'success');
      } finally {
        profRefrescar.disabled = false;
        profRefrescar.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refrescar';
      }
    });
  }

  const profSearch = document.getElementById('prof-search');
  if (profSearch && !profSearch.dataset.wired) {
    profSearch.dataset.wired = '1';
    profSearch.addEventListener('input', () => {
      profesorBusqueda = profSearch.value.trim().toLowerCase();
      renderProfesoresTable(filtrarProfesores(allProfesores));
    });
  }

  const cerrarModalYEsperar = (modalId) => new Promise((resolve) => {
    const modalEl = document.getElementById(modalId);
    if (!modalEl || !window.bootstrap?.Modal) { resolve(); return; }
    const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    if (!modalEl.classList.contains('show')) { resolve(); return; }
    const terminar = () => {
      modalEl.removeEventListener('hidden.bs.modal', terminar);
      document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
      if (!document.querySelector('.modal.show')) {
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
      }
      resolve();
    };
    modalEl.addEventListener('hidden.bs.modal', terminar, { once: true });
    instance.hide();
    setTimeout(terminar, 400);
  });

  const confirmarDestituirBtn = document.getElementById('confirmar-destituir-btn');
  if (confirmarDestituirBtn && !confirmarDestituirBtn.dataset.wired) {
    confirmarDestituirBtn.dataset.wired = '1';
    confirmarDestituirBtn.addEventListener('click', async () => {
      const motivo = document.getElementById('destituir-motivo')?.value.trim() || '';
      const idProfesor = profesorPendienteId;
      await cerrarModalYEsperar('modalDestituir');
      await destituirProfesor(idProfesor, motivo);
    });
  }

  const confirmarEliminarBtn = document.getElementById('confirmar-eliminar-btn');
  if (confirmarEliminarBtn && !confirmarEliminarBtn.dataset.wired) {
    confirmarEliminarBtn.dataset.wired = '1';
    confirmarEliminarBtn.addEventListener('click', async () => {
      const idProfesor = profesorPendienteId;
      await cerrarModalYEsperar('modalEliminarProfesor');
      await eliminarProfesor(idProfesor);
    });
  }

  const confirmarReintegrarBtn = document.getElementById('confirmar-reintegrar-btn');
  if (confirmarReintegrarBtn && !confirmarReintegrarBtn.dataset.wired) {
    confirmarReintegrarBtn.dataset.wired = '1';
    confirmarReintegrarBtn.addEventListener('click', async () => {
      const idProfesor = profesorReintegrarId;
      await cerrarModalYEsperar('modalReintegrar');
      await reintegrarProfesor(idProfesor);
    });
  }

  const asignarGruposSearch = document.getElementById('asignar-grupos-search');
  if (asignarGruposSearch && !asignarGruposSearch.dataset.wired) {
    asignarGruposSearch.dataset.wired = '1';
    asignarGruposSearch.addEventListener('input', () => {
      filtrarChecklistGrupos(asignarGruposSearch.value);
    });
  }

  const confirmarAsignarGruposBtn = document.getElementById('confirmar-asignar-grupos-btn');
  if (confirmarAsignarGruposBtn && !confirmarAsignarGruposBtn.dataset.wired) {
    confirmarAsignarGruposBtn.dataset.wired = '1';
    confirmarAsignarGruposBtn.addEventListener('click', async () => {
      const idProf = confirmarAsignarGruposBtn.dataset.idProf;
      if (!idProf) return;
      await guardarAsignacionGrupos(idProf);
    });
  }

  // Limpieza segura de backdrops al cerrar modales para prevenir bloqueos de pantalla
  const modalSustitutoEl = document.getElementById('modalAsignarSustituto');
  if (modalSustitutoEl && !modalSustitutoEl.dataset.wiredBackdrop) {
    modalSustitutoEl.dataset.wiredBackdrop = '1';
    modalSustitutoEl.addEventListener('hidden.bs.modal', () => {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    });
  }

  const modalAsignarGruposEl = document.getElementById('modalAsignarGrupos');
  if (modalAsignarGruposEl && !modalAsignarGruposEl.dataset.wiredBackdrop) {
    modalAsignarGruposEl.dataset.wiredBackdrop = '1';
    modalAsignarGruposEl.addEventListener('hidden.bs.modal', () => {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    });
  }
}

async function loadProfesores() {
  const profTableBody = document.querySelector('#profesores-table tbody');
  if (!profTableBody) return;

  try {
    const res = await apiFetch('/api/profesores');
    if (!res.ok) throw new Error('No se pudo cargar la lista de profesores');
    allProfesores = await res.json();
    actualizarStatsProfesores(allProfesores);
    renderProfesoresTable(filtrarProfesores(allProfesores));
  } catch (error) {
    profTableBody.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-3">Error al cargar profesores.</td></tr>';
    showToast(error.message || 'Error al obtener datos', 'error');
  }
}

function filtrarProfesores(profesores) {
  let resultado = profesores;

  if (profesorFiltroEstado === 'activos') {
    resultado = resultado.filter((p) => p.estado == 1 || p.estado === true);
  } else if (profesorFiltroEstado === 'inactivos') {
    resultado = resultado.filter((p) => !(p.estado == 1 || p.estado === true));
  }

  if (profesorBusqueda) {
    resultado = resultado.filter((p) => {
      const nombreComp = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.toLowerCase();
      const materia = (p.materia ?? '').toLowerCase();
      const correo = (p.correo ?? '').toLowerCase();
      return nombreComp.includes(profesorBusqueda) || materia.includes(profesorBusqueda) || correo.includes(profesorBusqueda);
    });
  }

  return resultado;
}

function actualizarStatsProfesores(profesores) {
  const total = profesores.length;
  const activos = profesores.filter((p) => p.estado == 1 || p.estado === true).length;
  const inactivos = total - activos;
  const pendientes = profesores.reduce((acc, p) => acc + Number(p.grupos_pendientes ?? 0), 0);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('prof-cnt-total', total);
  setText('prof-cnt-activos', activos);
  setText('prof-cnt-inactivos', inactivos);
  setText('prof-cnt-pendientes', pendientes);
}

function renderProfesoresTable(profesores) {
  const profTableBody = document.querySelector('#profesores-table tbody');
  if (!profTableBody) return;
  profTableBody.innerHTML = '';

  const esAdmin = (currentUser?.rol || '').toLowerCase() === 'administrador';

  if (!profesores.length) {
    const mensaje = (profesorFiltroEstado !== 'todos' || profesorBusqueda)
      ? 'No hay profesores que coincidan con la búsqueda o el filtro seleccionado.'
      : 'No hay profesores registrados.';
    profTableBody.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-4">${mensaje}</td></tr>`;
    return;
  }

  profesores.forEach((p) => {
    const idProf = p.id_profesor ?? p.id;
    const nombreComp = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
    const materia = p.materia ?? 'N/A';
    const ingreso = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : 'N/A';
    const activo = p.estado == 1 || p.estado === true;
    const grupoPendientes = Number(p.grupos_pendientes ?? 0);

    const badgeEstado = activo 
      ? '<span class="badge bg-success">Activo</span>' 
      : '<span class="badge bg-danger" title="Profesor incapacitado o inactivo">Inactivo</span>';

    const gruposProfesor = String(p.grupos_asignados || '')
      .split(/,\s*(?=[^,]+(?:·|\-|$))/)
      .map((grupo) => grupo.trim())
      .filter(Boolean);

    const celdaGrupos = activo
      ? (gruposProfesor.length
          ? `<div class="profesor-groups-list">${gruposProfesor.map((grupo) => `<span class="profesor-group-pill"><i class="bi bi-calendar3"></i>${grupo}</span>`).join('')}</div>`
          : '<span class="text-muted small">Sin grupos asignados</span>')
      : (grupoPendientes > 0
          ? `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" title="Grupos pendientes por cubrir o restaurar">${grupoPendientes} grupo(s) pendiente(s)</span>`
          : '<span class="text-muted small">Sin grupos pendientes</span>');

    const tr = document.createElement('tr');
    if (!activo) tr.classList.add('profesor-row-inactivo');
    tr.innerHTML = `
      <td><div class="profesor-name-cell"><strong>${nombreComp}</strong><small>Docente</small></div></td>
      <td><span class="badge bg-light text-dark border px-2 py-1">${materia}</span></td>
      <td>${ingreso}</td>
      <td>${celdaGrupos}</td>
      <td>${badgeEstado}</td>
      <td class="text-end">
        <div class="profesor-actions-grid">
          ${esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-secondary profesor-action-btn editar-profesor-btn" data-id="${idProf}">
              <i class="bi bi-pencil-square me-1"></i>Editar
            </button>
          ` : ''}
          ${activo && esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-primary profesor-action-btn asignar-grupos-btn" data-id="${idProf}" data-nombre="${nombreComp}" data-materia="${materia}">
              <i class="bi bi-diagram-3 me-1"></i>Grupos
            </button>
          ` : ''}
          ${activo && esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-warning profesor-action-btn destituir-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-person-slash me-1"></i>Destituir
            </button>
          ` : ''}
          ${!activo && esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-success profesor-action-btn reintegrar-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-person-check-fill me-1"></i>Reintegrar
            </button>
          ` : ''}
          ${!activo && esAdmin && grupoPendientes > 0 ? `
            <button type="button" class="btn btn-sm btn-outline-primary profesor-action-btn sustituto-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-person-lines-fill me-1"></i>Sustituto
            </button>
          ` : ''}
          ${esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-danger profesor-action-btn eliminar-profesor-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-trash me-1"></i>Eliminar
            </button>
          ` : ''}
          ${!esAdmin ? `<span class="text-muted small">Sin acciones</span>` : ''}
        </div>
      </td>
    `;
    profTableBody.appendChild(tr);
  });
}

async function handleProfesorSubmit(e) {
  e.preventDefault();

  const nombre = document.getElementById('prof-nombre')?.value.trim();
  const apellido1 = document.getElementById('prof-apellido1')?.value.trim();
  const materia = document.getElementById('prof-materia')?.value;
  const correo = document.getElementById('prof-correo')?.value.trim();
  const contrasena = document.getElementById('prof-contrasena')?.value || '';

  if (!nombre || !apellido1 || !materia) {
    showToast('Por favor completa el nombre, apellido y selecciona una materia.', 'error');
    return;
  }

  if (!correo || !contrasena) {
    showToast('Ingresa el correo y la contraseña de acceso del docente.', 'error');
    return;
  }

  if (!isSchoolEmail(correo)) {
    showToast(`El profesor debe utilizar un correo institucional @${SCHOOL_EMAIL_DOMAIN}.`, 'error');
    return;
  }

  if (contrasena.length < 6) {
    showToast('La contraseña de acceso debe tener al menos 6 caracteres.', 'error');
    return;
  }

  const payload = {
    nombre: nombre,
    apellido1: apellido1,
    apellido2: document.getElementById('prof-apellido2')?.value.trim() || '',
    fecha_nacimiento: document.getElementById('prof-fecha-nac')?.value || null,
    genero: document.getElementById('prof-genero')?.value || null,
    materia: materia,
    fecha_ingreso: document.getElementById('prof-fecha-ingreso')?.value || null,
    correo: correo,
    contrasena: contrasena
  };

  try {
    const res = await apiFetch('/api/profesores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      const modalEl = document.getElementById('modalProfesor');
      if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.hide();
      }

      document.getElementById('profesor-form')?.reset();
      await loadProfesores();
      await populateProfesoresSelects();
      await refreshDashboardCounts();
      showResultModal('success', 'Profesor registrado', 'El profesor fue agregado correctamente al cuerpo docente.');
    } else {
      showResultModal('error', 'No se pudo registrar', json.error || json.mensaje || 'Ocurrió un error registrando al profesor.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  }
}

function handleProfesorTableClick(e) {
  const btnDestituir = e.target.closest('.destituir-btn');
  const btnEliminar = e.target.closest('.eliminar-profesor-btn');
  const btnReintegrar = e.target.closest('.reintegrar-btn');
  const btnSustituto = e.target.closest('.sustituto-btn');
  const btnAsignarGrupos = e.target.closest('.asignar-grupos-btn');
  const btnEditar = e.target.closest('.editar-profesor-btn');

  if (btnDestituir || btnEliminar || btnReintegrar || btnSustituto || btnAsignarGrupos || btnEditar) {
    e.preventDefault();
  }

  if (btnEditar) {
    abrirEdicionProfesor(btnEditar.dataset.id);
  }

  if (btnDestituir) {
    profesorPendienteId = btnDestituir.dataset.id;
    const nombreEl = document.getElementById('destituir-nombre-profesor');
    if (nombreEl) nombreEl.textContent = btnDestituir.dataset.nombre || '';
    const motivoEl = document.getElementById('destituir-motivo');
    if (motivoEl) motivoEl.value = 'Incapacidad médica / Salida';

    const modalEl = document.getElementById('modalDestituir');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  if (btnEliminar) {
    profesorPendienteId = btnEliminar.dataset.id;
    const nombreEl = document.getElementById('eliminar-nombre-profesor');
    if (nombreEl) nombreEl.textContent = btnEliminar.dataset.nombre || '';

    const modalEl = document.getElementById('modalEliminarProfesor');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  if (btnReintegrar) {
    profesorReintegrarId = btnReintegrar.dataset.id;
    const nombreEl = document.getElementById('reintegrar-nombre-profesor');
    if (nombreEl) nombreEl.textContent = btnReintegrar.dataset.nombre || '';

    const modalEl = document.getElementById('modalReintegrar');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  if (btnSustituto) {
    abrirModalAsignarSustituto(btnSustituto.dataset.id, btnSustituto.dataset.nombre || '');
  }

  if (btnAsignarGrupos) {
    abrirModalAsignarGrupos(
      btnAsignarGrupos.dataset.id,
      btnAsignarGrupos.dataset.nombre || '',
      btnAsignarGrupos.dataset.materia || ''
    );
  }
}

function abrirEdicionProfesor(idProf) {
  const profesor = allProfesores.find((p) => String(p.id_profesor ?? p.id) === String(idProf));
  if (!profesor) { showToast('No se encontró el profesor seleccionado.', 'error'); return; }
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('edit-prof-id', profesor.id_profesor ?? profesor.id);
  set('edit-prof-nombre', profesor.nombre);
  set('edit-prof-apellido1', profesor.apellido1);
  set('edit-prof-apellido2', profesor.apellido2);
  set('edit-prof-materia', profesor.materia);
  set('edit-prof-correo', profesor.correo);
  set('edit-prof-genero', profesor.genero || 'O');
  set('edit-prof-fecha-nac', String(profesor.fecha_nacimiento || '').slice(0, 10));
  set('edit-prof-fecha-ingreso', String(profesor.fecha_ingreso || '').slice(0, 10));
  const modalEl = document.getElementById('modalEditarProfesor');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function guardarEdicionProfesor(event) {
  event.preventDefault();
  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const id = Number(val('edit-prof-id'));
  const payload = {
    nombre: val('edit-prof-nombre'),
    apellido1: val('edit-prof-apellido1'),
    apellido2: val('edit-prof-apellido2'),
    materia: val('edit-prof-materia'),
    correo: val('edit-prof-correo'),
    genero: val('edit-prof-genero'),
    fecha_nacimiento: val('edit-prof-fecha-nac'),
    fecha_ingreso: val('edit-prof-fecha-ingreso')
  };
  if (!id || !payload.nombre || !payload.apellido1 || !payload.correo || !payload.fecha_nacimiento) {
    showToast('Completa todos los datos obligatorios.', 'error'); return;
  }
  if (!isSchoolEmail(payload.correo)) { showToast(`Utiliza un correo institucional @${SCHOOL_EMAIL_DOMAIN}.`, 'error'); return; }
  try {
    const res = await apiFetch(`/api/profesores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo actualizar el profesor.');
    bootstrap.Modal.getInstance(document.getElementById('modalEditarProfesor'))?.hide();
    await loadProfesores();
    await populateProfesoresSelects();
    showResultModal('success', 'Profesor actualizado', 'Los datos del docente se actualizaron sin alterar sus grupos ni historial.');
  } catch (error) { showResultModal('error', 'No se pudo actualizar', error.message || 'Ocurrió un error al actualizar.'); }
}

async function destituirProfesor(idProf, motivo) {
  if (!idProf) return;
  try {
    const res = await apiFetch(`/api/profesores/${idProf}/destituir`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });

    if (res.ok) {
      showResultModal(
        'success',
        'Profesor incapacitado',
        'El profesor fue marcado como inactivo y retirado de todos sus grupos asignados.'
      );
      await loadProfesores();
      await populateProfesoresSelects();
    } else {
      const json = await res.json().catch(() => ({}));
      showResultModal('error', 'No se pudo destituir', json.error || 'Ocurrió un error al procesar la destitución.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    profesorPendienteId = null;
  }
}

async function eliminarProfesor(idProf) {
  if (!idProf) return;
  try {
    const res = await apiFetch(`/api/profesores/${idProf}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showResultModal('success', 'Profesor eliminado', 'El profesor, su acceso y los registros asociados fueron eliminados permanentemente del sistema.');
      await loadProfesores();
      await populateProfesoresSelects();
      await refreshDashboardCounts();
    } else {
      showResultModal('error', 'No se pudo eliminar', json.error || json.mensaje || 'Ocurrió un error al eliminar el profesor.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    profesorPendienteId = null;
  }
}

async function reintegrarProfesor(idProf) {
  if (!idProf) return;
  try {
    const res = await apiFetch(`/api/profesores/${idProf}/reintegrar`, { method: 'PUT' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      const restaurados = json.resultado?.grupos_restaurados?.length ?? 0;
      const omitidos = json.resultado?.grupos_omitidos?.length ?? 0;
      let mensaje = 'El profesor fue marcado como activo nuevamente.';
      if (restaurados > 0) mensaje += ` Se le restauraron ${restaurados} grupo(s).`;
      if (omitidos > 0) mensaje += ` ${omitidos} grupo(s) ya no existían y no se pudieron restaurar.`;
      showResultModal('success', 'Profesor reintegrado', mensaje);
      await loadProfesores();
      await populateProfesoresSelects();
    } else {
      showResultModal('error', 'No se pudo reintegrar', json.error || 'Ocurrió un error al reintegrar al profesor.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    profesorReintegrarId = null;
  }
}

async function abrirModalAsignarSustituto(idProfTitular, nombreTitular) {
  const nombreEl = document.getElementById('sustituto-nombre-profesor');
  if (nombreEl) nombreEl.textContent = nombreTitular || '';

  const modalEl = document.getElementById('modalAsignarSustituto');
  if (modalEl) new bootstrap.Modal(modalEl).show();

  const lista = document.getElementById('sustituto-lista');
  if (lista) lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">Cargando grupos pendientes...</p>';

  try {
    const [resSuplencias, resProfesores] = await Promise.all([
      apiFetch('/api/profesores/suplencias/pendientes'),
      apiFetch('/api/profesores')
    ]);

    if (!resSuplencias.ok) throw new Error('No se pudieron cargar los grupos pendientes.');

    const suplencias = (await resSuplencias.json()).filter(
      (s) => String(s.id_profesor_titular) === String(idProfTitular)
    );
    const profesores = resProfesores.ok ? await resProfesores.json() : [];
    const titular = profesores.find((p) => String(p.id_profesor ?? p.id) === String(idProfTitular));
    const materiaTitular = String(titular?.materia || suplencias[0]?.titular_materia || '').trim().toLowerCase();
    const profesoresActivos = profesores.filter(
      (p) =>
        (p.estado == 1 || p.estado === true) &&
        String(p.id_profesor ?? p.id) !== String(idProfTitular) &&
        String(p.materia || '').trim().toLowerCase() === materiaTitular
    );

    renderListaSuplencias(suplencias, profesoresActivos, idProfTitular, titular?.materia || suplencias[0]?.titular_materia || '');
  } catch (error) {
    if (lista) lista.innerHTML = `<p class="text-danger text-center py-3 mb-0">${error.message || 'Error al cargar los grupos pendientes.'}</p>`;
  }
}

function renderListaSuplencias(suplencias, profesoresActivos, idProfTitular, materiaTitular = "") {
  const lista = document.getElementById('sustituto-lista');
  if (!lista) return;

  if (!suplencias.length) {
    lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">Este profesor no tiene grupos pendientes de cubrir o restaurar.</p>';
    return;
  }

  const opcionesProfesores = profesoresActivos
    .map((p) => `<option value="${p.id_profesor ?? p.id}">${p.nombre} ${p.apellido1} (${p.materia || 'General'})</option>`)
    .join('');

  const avisoMateria = `<div class="alert alert-light border py-2 px-3 small mb-3"><i class="bi bi-journal-bookmark me-2"></i>Solo se muestran profesores activos de <strong>${materiaTitular || 'la misma materia'}</strong>.</div>`;
  const sinOpciones = profesoresActivos.length === 0
    ? '<div class="alert alert-warning py-2 px-3 small">No hay otro profesor activo disponible que imparta esta materia.</div>'
    : '';

  lista.innerHTML = avisoMateria + sinOpciones + suplencias.map((s) => `
    <div class="border rounded-3 p-3 d-flex align-items-center justify-content-between gap-3 flex-wrap" data-suplencia-row="${s.id_suplencia}">
      <div>
        <div class="fw-semibold">${s.nombre_grupo ?? 'Grupo #' + s.id_grupo}${s.nombre_seccion ? ` · Sección ${s.nombre_seccion}` : ''}</div>
        <div class="small text-muted">
          ${s.id_profesor_suplente
            ? `Cubierto provisionalmente por: <strong>${s.suplente_nombre}</strong>`
            : 'Sin sustituto asignado todavía'}
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <select class="form-select form-select-sm sustituto-select" style="min-width: 220px;" data-grupo="${s.id_grupo}">
          <option value="" disabled ${s.id_profesor_suplente ? '' : 'selected'}>Seleccionar profesor</option>
          ${opcionesProfesores}
        </select>
        <button type="button" class="btn btn-sm btn-primary asignar-sustituto-confirm-btn"
          data-grupo="${s.id_grupo}" data-titular="${idProfTitular}">
          <i class="bi bi-check2"></i> ${s.id_profesor_suplente ? 'Cambiar' : 'Asignar'}
        </button>
      </div>
    </div>
  `).join('');

  lista.querySelectorAll('.asignar-sustituto-confirm-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fila = btn.closest('[data-suplencia-row]');
      const select = fila?.querySelector('.sustituto-select');
      const idGrupo = btn.dataset.grupo;
      const idTitular = btn.dataset.titular;
      const idNuevoProfesor = select?.value;

      if (!idNuevoProfesor) {
        showToast('Selecciona un profesor sustituto primero.', 'error');
        return;
      }

      await asignarSustituto(idGrupo, idNuevoProfesor, idTitular);
    });
  });
}

async function asignarSustituto(idGrupo, idNuevoProfesor, idProfesorAnterior) {
  try {
    const res = await apiFetch('/api/profesores/reasignar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupoId: parseInt(idGrupo, 10),
        profesorId: parseInt(idNuevoProfesor, 10),
        profesorAnteriorId: parseInt(idProfesorAnterior, 10)
      })
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Grupo asignado provisionalmente. Se restaurará al titular al reintegrarlo.', 'success');
      await loadProfesores();
      const nombreTitular = document.getElementById('sustituto-nombre-profesor')?.textContent || '';
      await abrirModalAsignarSustituto(idProfesorAnterior, nombreTitular);
    } else {
      showToast(json.error || 'No se pudo asignar el sustituto.', 'error');
    }
  } catch {
    showToast('Error de conexión al asignar el sustituto.', 'error');
  }
}

async function populateProfesoresSelects(isGestion = false) {
  try {
    const res = await apiFetch('/api/profesores');
    if (!res.ok) return;
    const profesores = await res.json();
    const grupoProfSel = document.getElementById('grupo-profesor');
    const asisProfSel = document.getElementById('asis-id-profesor');
    const gestionProfSel = document.getElementById('gestion-grupo-profesor');

    [grupoProfSel, asisProfSel, gestionProfSel].forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccionar profesor</option>';
    });

    const profesoresActivos = profesores.filter((p) => p.estado == 1 || p.estado === true);

    profesoresActivos.forEach((p) => {
      const id = p.id_profesor ?? p.id;
      const opt = new Option(`${p.nombre} ${p.apellido1} (${p.materia || 'General'})`, id);
      opt.dataset.busqueda = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''} ${p.materia ?? ''}`.toLowerCase();
      if (grupoProfSel) grupoProfSel.add(opt.cloneNode(true));
      if (asisProfSel) asisProfSel.add(opt.cloneNode(true));
      if (gestionProfSel) gestionProfSel.add(opt.cloneNode(true));
    });

    filtrarProfesoresGrupo(document.getElementById('grupo-profesor-search')?.value || '');
    filtrarProfesoresGestion(document.getElementById('gestion-profesor-search')?.value || '');
    document.getElementById('grupo-profesor-count')?.classList.remove('text-bg-primary');
    const gestionSel = document.getElementById('gestion-grupo-profesor');
    const gestionSearch = document.getElementById('gestion-profesor-search');
    if (!isGestion && gestionSel) { gestionSel.disabled = true; if (gestionSearch) gestionSearch.disabled = true; }
    const grupoSel = document.getElementById('grupo-profesor');
    if (grupoSel) { grupoSel.disabled = false; }
    if (isGestion) {
      await cargarDetalleGestionGrupo(Number(document.getElementById('gestion-grupo-select')?.value || 0));
    }
  } catch (error) {
    console.error('Error poblando profesores', error);
  }
}

function filtrarProfesoresGrupo(termino) {
  const select = document.getElementById('grupo-profesor');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });
}

function filtrarProfesoresGestion(termino) {
  const select = document.getElementById('gestion-grupo-profesor');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });
}

/* ==========================================
   ASIGNAR GRUPOS A UN PROFESOR (desde su ficha)
   Un profesor puede quedar marcado en varios grupos.
   Si quieres que un grupo tenga Español, Matemáticas y
   Ciencias cubiertas, repite este flujo con cada profesor
   y marca el mismo grupo en los tres: grupo_profesor admite
   varios profesores por grupo, uno por cada materia.
   ========================================== */

let profesorGruposActualesIds = [];

async function abrirModalAsignarGrupos(idProf, nombreProf, materiaProf) {
  const nombreEl = document.getElementById('asignar-grupos-nombre-profesor');
  if (nombreEl) nombreEl.textContent = nombreProf || '';
  const materiaEl = document.getElementById('asignar-grupos-materia');
  if (materiaEl) materiaEl.textContent = materiaProf || 'su materia';

  const btnConfirmar = document.getElementById('confirmar-asignar-grupos-btn');
  if (btnConfirmar) btnConfirmar.dataset.idProf = idProf;

  const modalEl = document.getElementById('modalAsignarGrupos');
  if (modalEl) new bootstrap.Modal(modalEl).show();

  const lista = document.getElementById('asignar-grupos-lista');
  if (lista) lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">Cargando grupos...</p>';

  const searchInput = document.getElementById('asignar-grupos-search');
  if (searchInput) searchInput.value = '';

  const profesor = allProfesores.find((p) => String(p.id_profesor ?? p.id) === String(idProf));
  profesorGruposActualesIds = (profesor?.grupos_ids || '')
    .split(',')
    .map((v) => parseInt(v, 10))
    .filter((v) => !isNaN(v));

  try {
    const res = await apiFetch('/api/procesos/grupos');
    if (!res.ok) throw new Error('No se pudieron cargar los grupos.');
    const grupos = await res.json();
    renderChecklistGrupos(grupos);
  } catch (error) {
    if (lista) lista.innerHTML = `<p class="text-danger text-center py-3 mb-0">${error.message || 'Error al cargar los grupos.'}</p>`;
  }
}

function renderChecklistGrupos(grupos) {
  const lista = document.getElementById('asignar-grupos-lista');
  if (!lista) return;

  if (!grupos.length) {
    lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">No hay grupos creados todavía. Crea uno desde Matrícula.</p>';
    return;
  }

  lista.innerHTML = grupos.map((g) => {
    const id = g.id_grupo ?? g.id;
    const checked = profesorGruposActualesIds.includes(Number(id)) ? 'checked' : '';
    const horaInicio = g.hora_inicio ? String(g.hora_inicio).slice(0, 5) : '';
    const horaFin = g.hora_fin ? String(g.hora_fin).slice(0, 5) : '';
    const horario = horaInicio && horaFin ? ` · Horario ${horaInicio} - ${horaFin}` : ' · Horario no definido';
    const etiqueta = `${g.nombre_grupo ?? 'Grupo'} · ${g.nombre_seccion || g.nivel || ''} · Cupo ${g.ocupados ?? 0}/${g.capacidad ?? 0}${horario}`;
    const busqueda = `${g.nombre_grupo ?? ''} ${g.nombre_seccion ?? ''} ${g.nivel ?? ''} ${horaInicio} ${horaFin}`.toLowerCase();
    return `
      <label class="form-check d-flex align-items-center gap-2 border rounded-3 p-2 mb-0 asignar-grupo-item" data-busqueda="${busqueda}">
        <input class="form-check-input mt-0 asignar-grupo-checkbox" type="checkbox" value="${id}" ${checked}>
        <span class="small">${etiqueta}</span>
      </label>
    `;
  }).join('');
}

function filtrarChecklistGrupos(termino) {
  const busqueda = (termino || '').trim().toLowerCase();
  document.querySelectorAll('#asignar-grupos-lista .asignar-grupo-item').forEach((item) => {
    const texto = item.dataset.busqueda || '';
    item.classList.toggle('hidden', !!busqueda && !texto.includes(busqueda));
  });
}

async function guardarAsignacionGrupos(idProf) {
  const seleccionados = Array.from(
    document.querySelectorAll('#asignar-grupos-lista .asignar-grupo-checkbox:checked')
  ).map((el) => parseInt(el.value, 10));

  const btnConfirmar = document.getElementById('confirmar-asignar-grupos-btn');
  if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    const res = await apiFetch(`/api/profesores/${idProf}/grupos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupos: seleccionados })
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Grupos del profesor actualizados correctamente.', 'success');
      const modalEl = document.getElementById('modalAsignarGrupos');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      await loadProfesores();
    } else {
      showToast(json.error || 'No se pudo actualizar la asignación de grupos.', 'error');
    }
  } catch {
    showToast('Error de conexión al asignar los grupos.', 'error');
  } finally {
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar asignación'; }
  }
}
export { populateProfesoresSelects, filtrarProfesoresGestion };
