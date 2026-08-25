import {
  apiFetch,
  currentUser,
  showResultModal,
  showToast
} from './ui.js';

import {
  refreshDashboardCounts
} from './dashboard.js';

import {
  populateProfesoresSelects,
  filtrarProfesoresGestion
} from './profesores.js';

(function () {
  const moduleName = 'matricula';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireMatriculaEvents();
    },
    load: loadMatriculaData
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE MATRÍCULA
   Matrícula de estudiantes, grupos y secciones académicas.
   ========================================== */

let allGrupos = [];
let allSecciones = [];

function wireMatriculaEvents() {
  configurarSelectoresProfesores();
  configurarDisponibilidadAulas();
  const matForm = document.getElementById('matricula-form');
  if (matForm && !matForm.dataset.wired) {
    matForm.dataset.wired = '1';
    matForm.addEventListener('submit', handleMatriculaSubmit);
  }

  const estudianteMatricula = document.getElementById('mat-persona');
  if (estudianteMatricula && !estudianteMatricula.dataset.finWired) {
    estudianteMatricula.dataset.finWired = '1';
    estudianteMatricula.addEventListener('change', validarEstadoFinancieroMatricula);
  }


  const grupoMatricula = document.getElementById('mat-id-grupo');
  if (grupoMatricula && !grupoMatricula.dataset.finWired) {
    grupoMatricula.dataset.finWired = '1';
    grupoMatricula.addEventListener('change', validarEstadoFinancieroMatricula);
  }

  const modalMatricula = document.getElementById('modalMatricula');
  if (modalMatricula && !modalMatricula.dataset.finWired) {
    modalMatricula.dataset.finWired = '1';
    modalMatricula.addEventListener('shown.bs.modal', validarEstadoFinancieroMatricula);
  }

  const grupoForm = document.getElementById('grupo-form');
  if (grupoForm && !grupoForm.dataset.wired) {
    grupoForm.dataset.wired = '1';
    grupoForm.addEventListener('submit', handleGrupoSubmit);
  }

  const gestionGrupoForm = document.getElementById('gestion-grupo-form');
  if (gestionGrupoForm && !gestionGrupoForm.dataset.wired) {
    gestionGrupoForm.dataset.wired = '1';
    gestionGrupoForm.addEventListener('submit', handleGestionGrupoSubmit);
  }

  const btnBorrarGrupo = document.getElementById('btn-borrar-grupo');
  if (btnBorrarGrupo && !btnBorrarGrupo.dataset.wired) {
    btnBorrarGrupo.dataset.wired = '1';
    btnBorrarGrupo.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const rawValue = document.getElementById('gestion-grupo-select')?.value;
      if (!rawValue) {
        showToast('Selecciona un grupo para borrar.', 'error');
        return;
      }

      const idGrupo = String(rawValue).split(':')[0].trim();

      if (!idGrupo || isNaN(idGrupo)) {
        showToast('ID de grupo inválido.', 'error');
        return;
      }

      const confirmarModalEl = document.getElementById('modalConfirmarEliminacion');
      if (confirmarModalEl) {
        const btnConfirmarAccion = document.getElementById('btn-confirmar-borrado-grupo');
        if (btnConfirmarAccion) btnConfirmarAccion.dataset.idGrupo = idGrupo;
        
        const modalConfirm = new bootstrap.Modal(confirmarModalEl);
        modalConfirm.show();
      }
    });
  }

  const btnConfirmarBorradoGrupo = document.getElementById('btn-confirmar-borrado-grupo');
  if (btnConfirmarBorradoGrupo && !btnConfirmarBorradoGrupo.dataset.wired) {
    btnConfirmarBorradoGrupo.dataset.wired = '1';
    btnConfirmarBorradoGrupo.addEventListener('click', async () => {
      const idGrupo = btnConfirmarBorradoGrupo.dataset.idGrupo;
      if (!idGrupo) return;

      const confirmarModalEl = document.getElementById('modalConfirmarEliminacion');
      if (confirmarModalEl) bootstrap.Modal.getInstance(confirmarModalEl)?.hide();

      await borrarGrupo(idGrupo);
    });
  }

  const gestionGrupoBtn = document.querySelector('[data-bs-target="#modalGestionGrupo"]');
  if (gestionGrupoBtn && !gestionGrupoBtn.dataset.wired) {
    gestionGrupoBtn.dataset.wired = '1';
    gestionGrupoBtn.addEventListener('click', async () => {
      await populateGestionGrupoModal();
      const profSel = document.getElementById('gestion-grupo-profesor');
      if (profSel) {
        profSel.innerHTML = '<option value="" disabled>Selecciona un grupo para cargar profesores</option>';
        profSel.disabled = true;
      }
      const profSearch = document.getElementById('gestion-profesor-search');
      const profClear = document.getElementById('gestion-profesor-clear');
      if (profSearch) profSearch.disabled = true;
      if (profClear) profClear.disabled = true;
      actualizarContadorProfesores('gestion-grupo-profesor', 'gestion-profesor-count');
    });
  }

  const gestionProfSearch = document.getElementById('gestion-profesor-search');
  if (gestionProfSearch && !gestionProfSearch.dataset.wired) {
    gestionProfSearch.dataset.wired = '1';
    gestionProfSearch.addEventListener('input', () => {
      filtrarProfesoresGestion(gestionProfSearch.value);
    });
  }

  const gestionGrupoSelect = document.getElementById('gestion-grupo-select');
  if (gestionGrupoSelect && !gestionGrupoSelect.dataset.wired) {
    gestionGrupoSelect.dataset.wired = '1';
    gestionGrupoSelect.addEventListener('change', async () => {
      const rawValue = gestionGrupoSelect.value;
      const cleanId = String(rawValue).split(':')[0].trim();
      if (!cleanId || Number.isNaN(Number(cleanId))) return;
      await populateProfesoresSelects(false);
      const profSel = document.getElementById('gestion-grupo-profesor');
      const profSearch = document.getElementById('gestion-profesor-search');
      const profClear = document.getElementById('gestion-profesor-clear');
      if (profSel) profSel.disabled = false;
      if (profSearch) profSearch.disabled = false;
      if (profClear) profClear.disabled = false;
      await cargarDetalleGestionGrupo(Number(cleanId));
      actualizarContadorProfesores('gestion-grupo-profesor', 'gestion-profesor-count');
    });
  }

  const periodoAnio = document.getElementById('periodo-admin-anio');
  if (periodoAnio && !periodoAnio.dataset.wired) {
    periodoAnio.dataset.wired = '1';
    periodoAnio.addEventListener('change', sincronizarPeriodoSeleccionado);
  }
  const btnGuardarPeriodo = document.getElementById('btn-guardar-periodo');
  if (btnGuardarPeriodo && !btnGuardarPeriodo.dataset.wired) {
    btnGuardarPeriodo.dataset.wired = '1';
    btnGuardarPeriodo.addEventListener('click', guardarPeriodoLectivo);
  }

  const grupoSeccionSearch = document.getElementById('grupo-seccion-search');
  if (grupoSeccionSearch && !grupoSeccionSearch.dataset.wired) {
    grupoSeccionSearch.dataset.wired = '1';
    grupoSeccionSearch.addEventListener('input', () => {
      filtrarSeccionesGrupo(grupoSeccionSearch.value);
    });
  }

  const seccionForm = document.getElementById('seccion-form');
  if (seccionForm && !seccionForm.dataset.wired) {
    seccionForm.dataset.wired = '1';
    seccionForm.addEventListener('submit', handleSeccionSubmit);
  }

  ['seccion-nivel', 'seccion-nombre'].forEach((id) => {
    const input = document.getElementById(id);
    if (input && !input.dataset.previewWired) {
      input.dataset.previewWired = '1';
      input.addEventListener('input', actualizarPreviewSeccion);
      input.addEventListener('change', actualizarPreviewSeccion);
      input.addEventListener('blur', () => {
        input.value = normalizarParteSeccion(input.value);
        actualizarPreviewSeccion();
      });
    }
  });

  const deleteSeccionSelect = document.getElementById('seccion-delete-select');
  const syncDeleteSeccionButton = () => {
    const button = document.getElementById('btn-borrar-seccion');
    if (button) button.disabled = !String(deleteSeccionSelect?.value || '').trim();
  };
  if (deleteSeccionSelect && !deleteSeccionSelect.dataset.deleteWired) {
    deleteSeccionSelect.dataset.deleteWired = '1';
    deleteSeccionSelect.addEventListener('change', syncDeleteSeccionButton);
  }
  syncDeleteSeccionButton();

  const btnBorrarSeccion = document.getElementById('btn-borrar-seccion');
  if (btnBorrarSeccion && !btnBorrarSeccion.dataset.wired) {
    btnBorrarSeccion.dataset.wired = '1';
    btnBorrarSeccion.addEventListener('click', async (e) => {
      e.preventDefault();
      const idSeccion = document.getElementById('seccion-delete-select')?.value;
      if (!idSeccion) {
        showToast('Selecciona una sección para borrar.', 'error');
        return;
      }
      
      const confirmarModalEl = document.getElementById('modalConfirmarEliminacionSeccion');
      if (confirmarModalEl) {
        const btnConfSec = document.getElementById('btn-confirmar-borrado-seccion');
        if (btnConfSec) btnConfSec.dataset.idSeccion = idSeccion;
        new bootstrap.Modal(confirmarModalEl).show();
      }
    });
  }

  const btnConfirmarBorradoSeccion = document.getElementById('btn-confirmar-borrado-seccion');
  if (btnConfirmarBorradoSeccion && !btnConfirmarBorradoSeccion.dataset.wired) {
    btnConfirmarBorradoSeccion.dataset.wired = '1';
    btnConfirmarBorradoSeccion.addEventListener('click', async () => {
      const idSeccion = btnConfirmarBorradoSeccion.dataset.idSeccion;
      if (!idSeccion) return;
      const modalEl = document.getElementById('modalConfirmarEliminacionSeccion');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      await borrarSeccion(idSeccion);
    });
  }

  setDefaultSeccionPeriodo();

  const hoyISO = new Date().toISOString().split('T')[0];
  const matFechaInput = document.getElementById('mat-fecha');
  if (matFechaInput) matFechaInput.max = hoyISO;

  const btnAbrirModalGrupo = document.querySelector('[data-bs-target="#modalGrupo"]');
  if (btnAbrirModalGrupo && !btnAbrirModalGrupo.dataset.wired) {
    btnAbrirModalGrupo.dataset.wired = '1';
    btnAbrirModalGrupo.addEventListener('click', async () => {
      await populateGruposSelects();
      await populateSeccionesSelect();
      await populateProfesoresSelects(false);
    });
  }

  const btnAbrirModalSeccion = document.querySelector('[data-bs-target="#modalSeccion"]');
  if (btnAbrirModalSeccion && !btnAbrirModalSeccion.dataset.wired) {
    btnAbrirModalSeccion.dataset.wired = '1';
    btnAbrirModalSeccion.addEventListener('click', async () => {
      await populateGruposSelects();
      await populateSeccionesSelect();
      setDefaultSeccionPeriodo();
    });
  }

  const btnAbrirModalMatricula = document.querySelector('[data-bs-target="#modalMatricula"]');
  if (btnAbrirModalMatricula && !btnAbrirModalMatricula.dataset.wired) {
    btnAbrirModalMatricula.dataset.wired = '1';
    btnAbrirModalMatricula.addEventListener('click', () => {
      populatePersonaSelects();
      populateGruposSelects();
    });
  }

  const modalMatriculaEl = document.getElementById('modalMatricula');
  if (modalMatriculaEl && !modalMatriculaEl.dataset.wired) {
    modalMatriculaEl.dataset.wired = '1';
    modalMatriculaEl.addEventListener('show.bs.modal', () => {
      const fechaInput = document.getElementById('mat-fecha');
      if (fechaInput && !fechaInput.value) {
        fechaInput.value = new Date().toISOString().split('T')[0];
      }
      actualizarInfoCupoGrupo();
    });
  }

  const matGrupoSel = document.getElementById('mat-id-grupo');
  if (matGrupoSel && !matGrupoSel.dataset.wired) {
    matGrupoSel.dataset.wired = '1';
    matGrupoSel.addEventListener('change', actualizarInfoCupoGrupo);
  }

  const matGrupoSearch = document.getElementById('mat-grupo-search');
  if (matGrupoSearch && !matGrupoSearch.dataset.wired) {
    matGrupoSearch.dataset.wired = '1';
    matGrupoSearch.addEventListener('input', () => {
      filtrarGruposMatricula(matGrupoSearch.value);
    });
  }

  const btnAbrirGestionMatricula = document.querySelector('[data-bs-target="#modalGestionMatricula"]');
  if (btnAbrirGestionMatricula && !btnAbrirGestionMatricula.dataset.wired) {
    btnAbrirGestionMatricula.dataset.wired = '1';
    btnAbrirGestionMatricula.addEventListener('click', () => {
      poblarSelectGruposGestionMatricula();
    });
  }

  const gmGrupoActual = document.getElementById('gm-grupo-actual');
  if (gmGrupoActual && !gmGrupoActual.dataset.wired) {
    gmGrupoActual.dataset.wired = '1';
    gmGrupoActual.addEventListener('change', cargarEstudiantesGestionMatricula);
  }

  const gmAccion = document.getElementById('gm-accion');
  if (gmAccion && !gmAccion.dataset.wired) {
    gmAccion.dataset.wired = '1';
    gmAccion.addEventListener('change', actualizarCamposGestionMatricula);
  }

  const gestionMatriculaForm = document.getElementById('gestion-matricula-form');
  if (gestionMatriculaForm && !gestionMatriculaForm.dataset.wired) {
    gestionMatriculaForm.dataset.wired = '1';
    gestionMatriculaForm.addEventListener('submit', handleGestionMatriculaSubmit);
  }
}

function poblarSelectGruposGestionMatricula() {
  const selActual = document.getElementById('gm-grupo-actual');
  const selNuevo = document.getElementById('gm-grupo-nuevo');
  const estudianteSel = document.getElementById('gm-estudiante');
  const hint = document.getElementById('gm-hint');
  const fechaInput = document.getElementById('gm-fecha');

  if (selActual) {
    selActual.innerHTML = '<option value="" disabled selected>Seleccionar grupo</option>';
    allGrupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      selActual.add(new Option(`${g.nombre_grupo ?? 'Grupo'}${g.nombre_seccion ? ` · Sección ${g.nombre_seccion}` : (g.nivel ? ` · ${g.nivel}` : '')}`, id));
    });
  }

  if (selNuevo) {
    selNuevo.innerHTML = '<option value="" disabled selected>Seleccionar grupo destino</option>';
    allGrupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      const ocupados = g.ocupados ?? 0;
      const capacidad = g.capacidad ?? 0;
      const lleno = ocupados >= capacidad;
      const opt = new Option(`${g.nombre_grupo ?? 'Grupo'}${g.nombre_seccion ? ` · Sección ${g.nombre_seccion}` : ''} · Cupo ${ocupados}/${capacidad}${lleno ? ' (LLENO)' : ''}`, id);
      opt.disabled = lleno;
      selNuevo.add(opt);
    });
  }

  if (estudianteSel) {
    estudianteSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    estudianteSel.disabled = true;
  }

  if (hint) {
    hint.textContent = 'Selecciona un grupo para ver a sus estudiantes.';
    hint.classList.remove('text-danger');
  }

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split('T')[0];
  }

  actualizarCamposGestionMatricula();
}

async function cargarEstudiantesGestionMatricula() {
  const grupoSel = document.getElementById('gm-grupo-actual');
  const estudianteSel = document.getElementById('gm-estudiante');
  const hint = document.getElementById('gm-hint');
  const selNuevo = document.getElementById('gm-grupo-nuevo');
  if (!grupoSel || !estudianteSel) return;

  const idGrupo = parseInt(grupoSel.value, 10);
  if (!idGrupo || isNaN(idGrupo)) return;

  estudianteSel.innerHTML = '<option value="" disabled selected>Cargando estudiantes...</option>';
  estudianteSel.disabled = true;

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) throw new Error('No se pudo cargar el detalle del grupo');
    const detalle = await res.json();
    const estudiantes = detalle.estudiantes || [];

    estudianteSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
    estudiantes.forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      estudianteSel.add(new Option(texto, e.id_estudiante));
    });
    estudianteSel.disabled = estudiantes.length === 0;

    if (hint) {
      if (estudiantes.length === 0) {
        hint.textContent = 'Este grupo no tiene estudiantes matriculados activos.';
        hint.classList.add('text-danger');
      } else {
        hint.textContent = `Se cargaron ${estudiantes.length} estudiante(s).`;
        hint.classList.remove('text-danger');
      }
    }

    if (selNuevo) {
      Array.from(selNuevo.options).forEach((opt) => {
        if (opt.value === '') return;
        opt.hidden = Number(opt.value) === idGrupo;
      });
    }
  } catch (error) {
    console.error('Error cargando estudiantes para gestión de matrícula', error);
    estudianteSel.innerHTML = '<option value="" disabled selected>Error al cargar estudiantes</option>';
  }
}

function actualizarCamposGestionMatricula() {
  const accion = document.getElementById('gm-accion')?.value;
  const camposTransferir = document.getElementById('gm-campos-transferir');
  const grupoNuevoSel = document.getElementById('gm-grupo-nuevo');
  if (!camposTransferir) return;

  const esTransferir = accion === 'transferir';
  camposTransferir.classList.toggle('hidden', !esTransferir);
  if (grupoNuevoSel) grupoNuevoSel.required = esTransferir;
}

async function handleGestionMatriculaSubmit(e) {
  e.preventDefault();

  const idGrupoActual = parseInt(document.getElementById('gm-grupo-actual')?.value, 10);
  const idEstudiante = parseInt(document.getElementById('gm-estudiante')?.value, 10);
  const accion = document.getElementById('gm-accion')?.value;

  if (!idGrupoActual || !idEstudiante) {
    showToast('Selecciona el grupo actual y el estudiante.', 'error');
    return;
  }

  const submitBtn = document.getElementById('gm-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    let res;

    if (accion === 'retirar') {
      res = await apiFetch(`/api/procesos/grupos/${idGrupoActual}/retirar-estudiante`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_estudiante: idEstudiante })
      });
    } else {
      const idGrupoNuevo = parseInt(document.getElementById('gm-grupo-nuevo')?.value, 10);
      if (!idGrupoNuevo) {
        showToast('Selecciona el grupo destino.', 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Guardar cambios'; }
        return;
      }

      const grupoDestino = allGrupos.find((g) => (g.id_grupo ?? g.id) === idGrupoNuevo);
      const fecha = document.getElementById('gm-fecha')?.value || new Date().toISOString().split('T')[0];
      const anio = grupoDestino?.periodo_lectivo ?? new Date(`${fecha}T00:00:00`).getFullYear();

      const payload = {
        id_estudiante: idEstudiante,
        id_grupo_actual: idGrupoActual,
        id_grupo_nuevo: idGrupoNuevo,
        fecha,
        periodo: parseInt(document.getElementById('gm-periodo')?.value, 10),
        anio,
        tipo: document.getElementById('gm-tipo')?.value || 'traslado',
        estado: 'activa',
        observaciones: document.getElementById('gm-observaciones')?.value.trim().slice(0, 150) || null,
        id_usuario: currentUser?.id_usuario ?? 1
      };

      res = await apiFetch('/api/procesos/matricula/transferir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast(
        accion === 'retirar' ? 'Estudiante retirado del grupo correctamente.' : 'Estudiante transferido correctamente.',
        'success'
      );
      document.getElementById('gestion-matricula-form')?.reset();
      const modalEl = document.getElementById('modalGestionMatricula');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      await populateGruposSelects();
      await populateSeccionesSelect();
    } else {
      showToast(json.mensaje || json.error || 'No se pudo completar la operación.', 'error');
    }
  } catch (error) {
    console.error('Error en gestión de matrícula', error);
    showToast('Error de conexión al gestionar la matrícula.', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Guardar cambios'; }
  }
}

async function loadMatriculaData() {
  await Promise.all([
    populatePersonaSelects(),
    populateGruposSelects()
  ]);
  await populateSeccionesSelect();
  await cargarPeriodosLectivos();
}

let periodosLectivos = [];

async function cargarPeriodosLectivos() {
  const card = document.getElementById('periodo-lectivo-card');
  const select = document.getElementById('periodo-admin-anio');
  const boton = document.getElementById('btn-guardar-periodo');
  if (!select) return;
  try {
    const res = await apiFetch('/api/procesos/secciones/periodos');
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.error || 'No se pudieron consultar los períodos.');
    periodosLectivos = Array.isArray(data) ? data : [];
    select.innerHTML = '';
    periodosLectivos.forEach((p) => select.add(new Option(`${p.anio} · ${String(p.estado || '').toUpperCase()}`, p.anio)));
    const actual = periodosLectivos.find((p) => Number(p.anio) === new Date().getFullYear()) || periodosLectivos[0];
    if (actual) select.value = String(actual.anio);
    sincronizarPeriodoSeleccionado();
    const admin = String(currentUser?.rol || '').toLowerCase() === 'administrador';
    if (card) card.style.display = admin ? '' : 'none';
    if (boton) boton.disabled = !admin;
  } catch (e) {
    if (card) card.style.display = 'none';
  }
}

function sincronizarPeriodoSeleccionado() {
  const anio = Number(document.getElementById('periodo-admin-anio')?.value || 0);
  const p = periodosLectivos.find((x) => Number(x.anio) === anio);
  if (!p) return;
  const inicio = document.getElementById('periodo-admin-inicio');
  const fin = document.getElementById('periodo-admin-fin');
  const estado = document.getElementById('periodo-admin-estado');
  if (inicio) inicio.value = p.fecha_inicio ? String(p.fecha_inicio).slice(0,10) : '';
  if (fin) fin.value = p.fecha_fin ? String(p.fecha_fin).slice(0,10) : '';
  if (estado) { estado.value = String(p.estado || 'PLANIFICADO').toUpperCase(); estado.disabled = String(p.estado || '').toUpperCase() === 'CERRADO'; }
  const boton = document.getElementById('btn-guardar-periodo');
  if (boton) boton.disabled = String(p.estado || '').toUpperCase() === 'CERRADO';
}

async function guardarPeriodoLectivo() {
  const anio = Number(document.getElementById('periodo-admin-anio')?.value || 0);
  const payload = {
    fecha_inicio: document.getElementById('periodo-admin-inicio')?.value,
    fecha_fin: document.getElementById('periodo-admin-fin')?.value,
    estado: document.getElementById('periodo-admin-estado')?.value
  };
  if (!anio || !payload.fecha_inicio || !payload.fecha_fin) { showToast('Completa las fechas del período.', 'error'); return; }
  if (payload.estado === 'CERRADO' && !window.confirm(`Cerrar ${anio} bloqueará matrículas, traslados, cambios de grupos y asistencias. ¿Continuar?`)) return;
  const btn = document.getElementById('btn-guardar-periodo');
  const original = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando…'; }
  try {
    const res = await apiFetch(`/api/procesos/secciones/periodos/${anio}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el período.');
    showToast(`Período ${anio} actualizado.`, 'success');
    await cargarPeriodosLectivos();
    await populateGruposSelects();
  } catch (e) { showToast(e.message, 'error'); }
  finally { if (btn?.isConnected && !btn.disabled) btn.innerHTML = original; else if (btn?.isConnected) btn.innerHTML = original; }
}

function normalizarParteSeccion(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

function construirNombreSeccion(nombre, nivel) {
  const parteNivel = normalizarParteSeccion(nivel);
  const parteNombre = normalizarParteSeccion(nombre).toUpperCase();
  if (!parteNivel) return parteNombre;
  if (!parteNombre) return parteNivel;

  const nivelMayuscula = parteNivel.toUpperCase();
  const nombreNormalizado = parteNombre.replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-');
  const yaIncluyeNivel = nombreNormalizado === nivelMayuscula ||
    nombreNormalizado.startsWith(`${nivelMayuscula}-`) ||
    nombreNormalizado.startsWith(`${nivelMayuscula} `);
  return yaIncluyeNivel ? nombreNormalizado : `${parteNivel}-${nombreNormalizado}`;
}

function formatearEtiquetaSeccion(seccion) {
  const base = construirNombreSeccion(seccion?.nombre, seccion?.nivel);
  const anio = seccion?.anio_lectivo ? ` (${seccion.anio_lectivo})` : '';
  return `${base || 'Sección'}${anio}`;
}

function actualizarPreviewSeccion() {
  const preview = document.getElementById('seccion-preview');
  if (!preview) return;
  const nivel = document.getElementById('seccion-nivel')?.value || '1';
  const nombre = document.getElementById('seccion-nombre')?.value || 'A';
  const etiqueta = construirNombreSeccion(nombre, nivel) || '1-A';
  const strong = preview.querySelector('strong');
  if (strong) strong.textContent = etiqueta;
}

function setDefaultSeccionPeriodo() {
  const input = document.getElementById('seccion-periodo');
  if (input && !input.value) input.value = new Date().getFullYear();
  actualizarPreviewSeccion();
}

async function populatePersonaSelects() {
  try {
    const res = await apiFetch('/api/estudiantes');
    if (!res.ok) return;
    const estudiantes = await res.json();
    const matSel = document.getElementById('mat-persona');

    if (matSel) {
      matSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
      estudiantes.forEach((p) => {
        const id = p.id_estudiante ?? p.id;
        const nombreCompleto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
        matSel.add(new Option(nombreCompleto, id));
      });
    }
  } catch (error) {
    console.error('Error poblando estudiantes', error);
  }
}

async function populateGruposSelects() {
  try {
    const res = await apiFetch('/api/procesos/grupos');
    if (!res.ok) return;
    const grupos = await res.json();
    allGrupos = grupos;
    const matGrupoSel = document.getElementById('mat-id-grupo');
    const asisGrupoSel = document.getElementById('asis-id-grupo');

    [matGrupoSel, asisGrupoSel].forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccionar grupo destino</option>';
    });

    grupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      const ocupados = g.ocupados ?? 0;
      const capacidad = g.capacidad ?? 0;
      const lleno = ocupados >= capacidad;
      const etiqueta = `${g.nombre_grupo ?? 'Grupo'}${g.nombre_seccion ? ` · Sección ${g.nombre_seccion}` : (g.nivel ? ` · ${g.nivel}` : '')} — Ocupados: ${ocupados}/${capacidad}${lleno ? ' (CUPO LLENO)' : ''}`;

      if (matGrupoSel) {
        const optMat = new Option(etiqueta, id);
        optMat.dataset.nombre = (g.nombre_grupo ?? '').toLowerCase();
        optMat.disabled = lleno;
        matGrupoSel.add(optMat);
      }
      if (asisGrupoSel) {
        asisGrupoSel.add(new Option(etiqueta, id));
      }
    });

    actualizarInfoCupoGrupo();
    filtrarGruposMatricula(document.getElementById('mat-grupo-search')?.value || '');
  } catch (error) {
    console.error('Error poblando grupos', error);
  }
}

function filtrarGruposMatricula(termino) {
  const select = document.getElementById('mat-id-grupo');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    if (option.value === '') return;
    const nombre = (option.dataset.nombre || option.textContent || '').toLowerCase();
    const coincide = !busqueda || nombre.includes(busqueda);
    option.hidden = !coincide;
  });

  // No seleccionar automáticamente el primer grupo.
  // El usuario debe elegirlo explícitamente.
}

async function borrarGrupo(idGrupo) {
  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.mensaje || json.error || 'No se pudo borrar el grupo.', 'error');
      return;
    }

    showToast('Grupo eliminado correctamente.', 'success');
    
    allGrupos = allGrupos.filter(g => String(g.id_grupo ?? g.id) !== String(idGrupo));

    const modalEl = document.getElementById('modalGestionGrupo');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

    document.getElementById('gestion-grupo-form')?.reset();
    
    await populateGruposSelects();
    await populateGestionGrupoModal();
  } catch (error) {
    console.error('Error al borrar grupo', error);
    showToast('Error al borrar el grupo.', 'error');
  }
}

async function actualizarInfoCupoGrupo() {
  const sel = document.getElementById('mat-id-grupo');
  const info = document.getElementById('mat-grupo-info');
  if (!sel || !info) return;

  const idSeleccionado = parseInt(sel.value, 10);
  const grupo = allGrupos.find((g) => (g.id_grupo ?? g.id) === idSeleccionado);

  if (!grupo) {
    info.textContent = 'Selecciona un grupo para ver el cupo disponible.';
    info.classList.remove('text-danger');
    return;
  }

  const ocupados = grupo.ocupados ?? 0;
  const capacidad = grupo.capacidad ?? 0;
  const disponibles = capacidad - ocupados;

  if (disponibles <= 0) {
    info.textContent = `Este grupo ya no tiene cupo disponible (${ocupados}/${capacidad}).`;
    info.classList.add('text-danger');
  } else {
    info.textContent = `Cupo disponible: ${disponibles} de ${capacidad} · Año lectivo: ${grupo.periodo_lectivo ?? '—'}.`;
    info.classList.remove('text-danger');
  }
}

async function populateSeccionesSelect() {
  try {
    const res = await apiFetch('/api/procesos/secciones');
    if (!res.ok) return [];
    const secciones = await res.json();
    allSecciones = Array.isArray(secciones) ? secciones : [];
    const sel = document.getElementById('grupo-seccion');
    const deleteSel = document.getElementById('seccion-delete-select');
    const hint = document.getElementById('grupo-seccion-empty-hint');

    if (sel) {
      sel.innerHTML = '<option value="" disabled selected>Seleccionar sección disponible</option>';
      const seccionesOcupadas = new Map(
        allGrupos
          .filter((g) => Number(g.id_seccion || 0) > 0)
          .map((g) => [Number(g.id_seccion), g])
      );

      secciones.forEach((s) => {
        const ocupadaPor = seccionesOcupadas.get(Number(s.id_seccion));
        const etiquetaBase = formatearEtiquetaSeccion(s);
        const etiqueta = ocupadaPor ? `${etiquetaBase} · Ocupada por ${ocupadaPor.nombre_grupo}` : etiquetaBase;
        const option = new Option(etiqueta, s.id_seccion);
        option.dataset.busqueda = `${s.nombre ?? ''} ${s.nivel ?? ''} ${s.anio_lectivo ?? ''} ${ocupadaPor?.nombre_grupo ?? ''}`.toLowerCase();
        option.disabled = Boolean(ocupadaPor);
        sel.add(option);
      });
    }
    if (deleteSel) {
      deleteSel.innerHTML = '<option value="" disabled selected>Seleccionar sección</option>';
      const seccionesOcupadas = new Map(
        allGrupos
          .filter((g) => Number(g.id_seccion || 0) > 0)
          .map((g) => [Number(g.id_seccion), g])
      );
      secciones.forEach((s) => {
        const ocupadaPor = seccionesOcupadas.get(Number(s.id_seccion));
        const etiquetaBase = formatearEtiquetaSeccion(s);
        const option = new Option(
          ocupadaPor ? `${etiquetaBase} · En uso por ${ocupadaPor.nombre_grupo}` : etiquetaBase,
          s.id_seccion
        );
        option.disabled = Boolean(ocupadaPor);
        deleteSel.add(option);
      });
      const deleteButton = document.getElementById('btn-borrar-seccion');
      if (deleteButton) deleteButton.disabled = true;
    }
    if (hint) hint.classList.toggle('hidden', secciones.length > 0);
    return secciones;
  } catch (error) {
    console.error('Error poblando secciones', error);
    return [];
  }
}

function filtrarSeccionesGrupo(termino) {
  const select = document.getElementById('grupo-seccion');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });

  // El filtro solo oculta opciones. La sección debe elegirse explícitamente para
  // evitar que se cree un grupo con una sección seleccionada accidentalmente.
  const actual = select.options[select.selectedIndex];
  if (actual?.hidden) select.value = '';
}

async function borrarSeccion(idSeccion) {
  try {
    const res = await apiFetch(`/api/procesos/secciones/${idSeccion}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.mensaje || json.error || 'No se pudo borrar la sección.', 'error');
      return;
    }

    showToast('Sección eliminada correctamente.', 'success');
    document.getElementById('seccion-form')?.reset();
    setDefaultSeccionPeriodo();
    await populateSeccionesSelect();
  } catch (error) {
    console.error('Error al borrar sección', error);
    showToast('Error al borrar la sección.', 'error');
  }
}

async function populateGestionGrupoModal() {
  const select = document.getElementById('gestion-grupo-select');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Seleccionar grupo</option>';
  allGrupos.forEach((grupo) => {
    const nombre = `${grupo.nombre_grupo} · ${grupo.nombre_seccion || grupo.id_seccion} · Cupo ${grupo.ocupados ?? 0}/${grupo.capacidad ?? 0}`;
    select.add(new Option(nombre, grupo.id_grupo));
  });
}

async function cargarDetalleGestionGrupo(idGrupo) {
  const grupo = allGrupos.find((g) => (g.id_grupo ?? g.id) === Number(idGrupo));
  const capacidadInput = document.getElementById('gestion-grupo-capacidad');
  const aulaSelect = document.getElementById('gestion-grupo-aula');
  const profSelect = document.getElementById('gestion-grupo-profesor');
  const horaInicioInput = document.getElementById('gestion-grupo-hora-inicio');
  const horaFinInput = document.getElementById('gestion-grupo-hora-fin');

  if (!grupo || !capacidadInput || !aulaSelect || !profSelect) return;

  profSelect.disabled = false;
  const profSearch = document.getElementById('gestion-profesor-search');
  const profClear = document.getElementById('gestion-profesor-clear');
  if (profSearch) profSearch.disabled = false;
  if (profClear) profClear.disabled = false;
  const ocupadosActuales = Number(grupo.ocupados ?? 0);
  capacidadInput.value = grupo.capacidad ?? 30;
  capacidadInput.min = String(Math.max(1, ocupadosActuales));
  capacidadInput.dataset.ocupados = String(ocupadosActuales);
  capacidadInput.title = ocupadosActuales > 0
    ? `Este grupo tiene ${ocupadosActuales} estudiante${ocupadosActuales === 1 ? '' : 's'} matriculado${ocupadosActuales === 1 ? '' : 's'}. La capacidad no puede ser menor a ${ocupadosActuales}.`
    : 'La capacidad debe ser mayor a cero.';
  aulaSelect.value = grupo.aula ?? '';
  actualizarDisponibilidadAulas('gestion');
  if (horaInicioInput) horaInicioInput.value = grupo.hora_inicio ? String(grupo.hora_inicio).slice(0, 5) : '';
  if (horaFinInput) horaFinInput.value = grupo.hora_fin ? String(grupo.hora_fin).slice(0, 5) : '';
  marcarDiasSeleccionados('gestion-grupo-dias', grupo.dias_semana || '');

  try {
    const res = await apiFetch(`/api/procesos/grupos/${grupo.id_grupo}/detalle`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    if (Array.isArray(json.profesores) && json.profesores.length > 0) {
      const selectedIds = json.profesores.map(p => String(p.id_profesor));
      Array.from(profSelect.options).forEach(opt => {
        opt.selected = selectedIds.includes(String(opt.value));
      });
    }
    actualizarContadorProfesores('gestion-grupo-profesor', 'gestion-profesor-count');
  } catch (error) {
    console.error('Error cargando detalle del grupo', error);
  }
}

async function handleGestionGrupoSubmit(e) {
  e.preventDefault();

  const rawGrupoVal = document.getElementById('gestion-grupo-select')?.value || 0;
  const idGrupo = Number(String(rawGrupoVal).split(':')[0].trim());
  const capacidad = Number(document.getElementById('gestion-grupo-capacidad')?.value || 0);
  const aula = document.getElementById('gestion-grupo-aula')?.value || null;
  const horaInicio = document.getElementById('gestion-grupo-hora-inicio')?.value || null;
  const horaFin = document.getElementById('gestion-grupo-hora-fin')?.value || null;
  const diasSemana = obtenerDiasSeleccionados('gestion-grupo-dias');
  
  const profSelect = document.getElementById('gestion-grupo-profesor');
  const profesoresSeleccionados = Array.from(profSelect?.selectedOptions || []).map(opt => parseInt(opt.value, 10));

  if (!idGrupo || !capacidad) {
    showToast('Selecciona un grupo y capacidad.', 'error');
    return;
  }
  if (!diasSemana.length) {
    showToast('Selecciona al menos un día de clase para el grupo.', 'error');
    return;
  }
  if (!horaInicio || !horaFin) {
    showToast('Indica la hora de inicio y la hora de finalización.', 'error');
    return;
  }
  if (horaFin <= horaInicio) {
    showToast('La hora de finalización debe ser posterior a la hora de inicio.', 'error');
    return;
  }

  const grupoActual = allGrupos.find((g) => Number(g.id_grupo ?? g.id) === idGrupo);
  const ocupadosActuales = Number(
    grupoActual?.ocupados ??
    document.getElementById('gestion-grupo-capacidad')?.dataset.ocupados ??
    0
  );

  if (capacidad < ocupadosActuales) {
    showToast(
      `No puedes reducir la capacidad a ${capacidad}. Hay ${ocupadosActuales} estudiante${ocupadosActuales === 1 ? '' : 's'} matriculado${ocupadosActuales === 1 ? '' : 's'} en este grupo.`,
      'error'
    );
    return;
  }

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacidad, aula, profesores: profesoresSeleccionados, hora_inicio: horaInicio, hora_fin: horaFin, dias_semana: diasSemana })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(json.error || json.mensaje || 'No se pudo actualizar el grupo.', 'error');
      return;
    }

    showToast('Grupo actualizado correctamente.', 'success');
    document.getElementById('gestion-grupo-form')?.reset();
    await populateGruposSelects();
    await populateGestionGrupoModal();
    await populateProfesoresSelects(true);
  } catch (error) {
    console.error('Error actualizando grupo', error);
    showToast('Error al actualizar el grupo.', 'error');
  }
}

let estadoFinancieroMatriculaActual = null;

async function validarEstadoFinancieroMatricula() {
  const idEstudiante = Number(document.getElementById('mat-persona')?.value || 0);
  const panel = document.getElementById('mat-estado-financiero');
  const texto = document.getElementById('mat-estado-financiero-texto');
  const deudasEl = document.getElementById('mat-deudas-pendientes');
  const submit = document.getElementById('mat-submit');
  estadoFinancieroMatriculaActual = null;

  if (!idEstudiante) {
    if (panel) panel.className = 'mat-financial-status neutral';
    if (texto) texto.textContent = 'Selecciona un estudiante para verificar el abono mínimo de matrícula.';
    if (deudasEl) deudasEl.innerHTML = '';
    if (submit) { submit.disabled = true; submit.textContent = 'Completar Matrícula'; }
    return;
  }

  const grupoId = Number(document.getElementById('mat-id-grupo')?.value || 0);
  const grupo = allGrupos.find(g => Number(g.id_grupo ?? g.id) === grupoId);
  const anio = grupo?.periodo_lectivo || new Date().getFullYear();
  if (texto) texto.textContent = 'Consultando pagos y saldos pendientes...';
  if (submit) { submit.disabled = true; submit.textContent = 'Validando...'; }

  try {
    const res = await apiFetch(`/api/finanzas/estudiantes/${idEstudiante}/estado-matricula?anio=${encodeURIComponent(anio)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.mensaje || 'No se pudo validar el estado financiero.');
    estadoFinancieroMatriculaActual = data;
    if (panel) panel.className = `mat-financial-status ${data.habilitado ? 'ok' : 'blocked'}`;
    if (texto) {
      const faltante = Math.max(0, Number(data.faltante_minimo ?? (Number(data.minimo_abono || 0) - Number(data.abono_matricula || 0))));
      texto.innerHTML = `
        <div class="mat-financial-compact">
          <div class="mat-financial-heading">
            <i class="bi ${data.habilitado ? 'bi-check-circle' : 'bi-wallet2'}"></i>
            <strong>${escapeHtmlMat(data.titulo || (data.habilitado ? 'Matrícula habilitada' : 'Pago inicial pendiente'))}</strong>
          </div>
          <div class="mat-financial-summary">
            <span>${data.habilitado ? 'Requisito financiero cubierto.' : `Faltan ${monedaMat(faltante)} para habilitar la matrícula.`}</span>
            <span class="mat-financial-inline-metrics">Abonado <strong>${monedaMat(data.abono_matricula)}</strong> · Mínimo <strong>${monedaMat(data.minimo_abono)}</strong></span>
          </div>
        </div>`;
    }
    const deudas = Array.isArray(data.deudas) ? data.deudas : [];
    if (deudasEl) {
      const principal = deudas[0];
      deudasEl.innerHTML = principal
        ? `<div class="mat-debt-compact"><span>${escapeHtmlMat(principal.concepto_nombre || principal.descripcion || 'Saldo pendiente')}</span><strong>${monedaMat(principal.saldo)}</strong>${deudas.length > 1 ? `<small>+${deudas.length - 1} cargo${deudas.length - 1 === 1 ? '' : 's'}</small>` : ''}</div>`
        : (data.habilitado ? '' : '<span class="mat-no-debt">Sin otros cargos pendientes.</span>');
    }
    if (submit) {
      submit.disabled = !data.habilitado;
      submit.textContent = data.habilitado ? 'Completar Matrícula' : 'Pago pendiente';
      submit.title = data.habilitado ? '' : 'El estudiante debe cumplir el abono mínimo antes de matricularse.';
    }
  } catch (error) {
    if (panel) panel.className = 'mat-financial-status blocked';
    if (texto) texto.textContent = error.message;
    if (deudasEl) deudasEl.innerHTML = '';
    if (submit) { submit.disabled = true; submit.textContent = 'Completar Matrícula'; }
  }
}

function monedaMat(valor) { return `CRC ${new Intl.NumberFormat('es-CR', { maximumFractionDigits:0 }).format(Number(valor || 0))}`; }
function escapeHtmlMat(valor) { return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function handleMatriculaSubmit(e) {
  e.preventDefault();
  const personaSelect = document.getElementById('mat-persona');
  const grupoSelect = document.getElementById('mat-id-grupo');

  if (!personaSelect.value || !grupoSelect.value) {
    showToast('Selecciona un estudiante y un grupo destino.', 'error');
    return;
  }

  await validarEstadoFinancieroMatricula();
  if (!estadoFinancieroMatriculaActual?.habilitado) {
    showToast(estadoFinancieroMatriculaActual?.mensaje || 'Se requiere un abono mínimo de CRC 10.000 antes de continuar con la matrícula.', 'error');
    return;
  }

  const personaId = parseInt(personaSelect.value, 10);
  const id_grupo = parseInt(String(grupoSelect.value).split(':')[0].trim(), 10);
  const grupoSeleccionado = allGrupos.find((g) => (g.id_grupo ?? g.id) === id_grupo);

  const fechaInput = document.getElementById('mat-fecha').value;
  const fecha = fechaInput || new Date().toISOString().split('T')[0];

  const anio = grupoSeleccionado?.periodo_lectivo ?? new Date(`${fecha}T00:00:00`).getFullYear();

  const payload = {
    fecha,
    periodo: parseInt(document.getElementById('mat-periodo').value, 10),
    anio,
    tipo: document.getElementById('mat-tipo').value,
    estado: 'activa',
    observaciones: document.getElementById('mat-observaciones').value.trim().slice(0, 150) || null,
    id_estudiante: personaId,
    id_usuario: currentUser?.id_usuario ?? 1,
    id_grupo: id_grupo
  };

  const submitBtn = document.getElementById('mat-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...'; }

  try {
    const res = await apiFetch('/api/procesos/matricula', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('¡Matrícula definitiva completada y cupo actualizado correctamente!', 'success');

      // Mantener la ventana abierta para que el administrador pueda procesar
      // varias matrículas consecutivas. Solo se cierra cuando la persona lo decide.
      const form = document.getElementById('matricula-form');
      form?.reset();

      await populateGruposSelects();
      await populatePersonaSelects();
      await refreshDashboardCounts();

      const fechaInput = document.getElementById('mat-fecha');
      if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];
      const infoGrupo = document.getElementById('mat-grupo-info');
      if (infoGrupo) infoGrupo.textContent = 'Selecciona un grupo para ver el cupo disponible.';
      await validarEstadoFinancieroMatricula();
    } else {
      showToast(json.error || json.mensaje || 'Error al procesar la matrícula', 'error');
    }
  } catch {
    showToast('Error de conexión al matricular', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = !estadoFinancieroMatriculaActual?.habilitado; submitBtn.innerHTML = 'Completar Matrícula'; }
  }
}

function actualizarContadorProfesores(selectId, countId) {
  const select = document.getElementById(selectId);
  const badge = document.getElementById(countId);
  if (!select || !badge) return;
  const total = Array.from(select.selectedOptions || []).filter(o => o.value).length;
  badge.textContent = total === 0 ? (selectId === 'gestion-grupo-profesor' ? 'Sin profesores' : 'Ninguno seleccionado') : `${total} ${total === 1 ? 'seleccionado' : 'seleccionados'}`;
  badge.className = `badge border ${total ? 'text-bg-primary' : 'text-bg-light'}`;
}

function configurarSelectoresProfesores() {
  const gestion = document.getElementById('gestion-grupo-profesor');
  if (gestion && !gestion.dataset.selectorWired) {
    gestion.dataset.selectorWired = '1';
    gestion.addEventListener('change', () => actualizarContadorProfesores('gestion-grupo-profesor', 'gestion-profesor-count'));
  }
  const clearGestion = document.getElementById('gestion-profesor-clear');
  if (clearGestion && !clearGestion.dataset.selectorWired) {
    clearGestion.dataset.selectorWired = '1';
    clearGestion.addEventListener('click', () => {
      if (!gestion) return;
      if (gestion.options[0]) gestion.options[0].selected = true;
      Array.from(gestion.options).slice(1).forEach((o) => { o.selected = false; });
      actualizarContadorProfesores('gestion-grupo-profesor', 'gestion-profesor-count');
    });
  }
}

function minutosHora(hora) {
  if (!hora) return null;
  const [h,m] = String(hora).slice(0,5).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function horariosChocan(inicioA, finA, inicioB, finB) {
  const a1=minutosHora(inicioA), a2=minutosHora(finA), b1=minutosHora(inicioB), b2=minutosHora(finB);
  return [a1,a2,b1,b2].every(Number.isFinite) && a1 < b2 && a2 > b1;
}

function diasChocan(a, b) {
  const sa = new Set((Array.isArray(a) ? a : String(a || '').split(',')).map(x => String(x).trim().toLowerCase()).filter(Boolean));
  return (Array.isArray(b) ? b : String(b || '').split(',')).some(x => sa.has(String(x).trim().toLowerCase()));
}

function actualizarDisponibilidadAulas(modo='crear') {
  const crear = modo === 'crear';
  const aulaSelect = document.getElementById(crear ? 'grupo-aula' : 'gestion-grupo-aula');
  if (!aulaSelect) return;
  const dias = obtenerDiasSeleccionados(crear ? 'grupo-dias' : 'gestion-grupo-dias');
  const inicio = document.getElementById(crear ? 'grupo-hora-inicio' : 'gestion-grupo-hora-inicio')?.value || '';
  const fin = document.getElementById(crear ? 'grupo-hora-fin' : 'gestion-grupo-hora-fin')?.value || '';
  const idExcluir = crear ? 0 : Number(String(document.getElementById('gestion-grupo-select')?.value || '').split(':')[0] || 0);
  let anio = null;
  if (crear) {
    const idSeccion = Number(document.getElementById('grupo-seccion')?.value || 0);
    anio = allSecciones.find(s => Number(s.id_seccion) === idSeccion)?.anio_lectivo || null;
  } else {
    anio = allGrupos.find(g => Number(g.id_grupo ?? g.id) === idExcluir)?.periodo_lectivo || null;
  }
  Array.from(aulaSelect.options).forEach((opt, idx) => {
    if (idx === 0 || !opt.value) return;
    const ocupante = allGrupos.find(g => Number(g.id_grupo ?? g.id) !== idExcluir && String(g.aula || '') === opt.value && (!anio || Number(g.periodo_lectivo) === Number(anio)) && diasChocan(dias, g.dias_semana) && horariosChocan(inicio, fin, g.hora_inicio, g.hora_fin));
    opt.disabled = Boolean(ocupante);
    opt.textContent = ocupante ? `${opt.value} · Ocupada por ${ocupante.nombre_grupo}` : opt.value;
  });
  if (aulaSelect.selectedOptions[0]?.disabled) aulaSelect.value = '';
}

function configurarDisponibilidadAulas() {
  const wireAvailability = (el, modo) => {
    if (!el || el.dataset.aulaWired) return;
    el.dataset.aulaWired = '1';
    el.addEventListener('change', () => actualizarDisponibilidadAulas(modo));
  };
  ['grupo-hora-inicio','grupo-hora-fin','grupo-seccion'].forEach((id) => wireAvailability(document.getElementById(id), 'crear'));
  document.querySelectorAll('#grupo-dias input[type="checkbox"]').forEach((el) => wireAvailability(el, 'crear'));
  ['gestion-grupo-hora-inicio','gestion-grupo-hora-fin','gestion-grupo-select'].forEach((id) => wireAvailability(document.getElementById(id), 'gestion'));
  document.querySelectorAll('#gestion-grupo-dias input[type="checkbox"]').forEach((el) => wireAvailability(el, 'gestion'));
}

function obtenerDiasSeleccionados(contenedorId) {
  return Array.from(document.querySelectorAll(`#${contenedorId} input[type="checkbox"]:checked`)).map((el) => el.value);
}

function marcarDiasSeleccionados(contenedorId, diasValor) {
  const dias = new Set(String(diasValor || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean));
  document.querySelectorAll(`#${contenedorId} input[type="checkbox"]`).forEach((el) => { el.checked = dias.has(el.value); });
}

async function handleGrupoSubmit(e) {
  e.preventDefault();
  sessionStorage.setItem('educontrol_active_view', 'matricula');

  const nombre = document.getElementById('grupo-nombre')?.value.trim() || '';
  const capacidad = parseInt(document.getElementById('grupo-capacidad')?.value || '', 10);
  const idSeccion = parseInt(document.getElementById('grupo-seccion')?.value || '', 10);
  const aula = document.getElementById('grupo-aula')?.value || null;
  const horaInicio = document.getElementById('grupo-hora-inicio')?.value || null;
  const horaFin = document.getElementById('grupo-hora-fin')?.value || null;
  const diasSemana = obtenerDiasSeleccionados('grupo-dias');

  if (!nombre) {
    showToast('Escribe un nombre para el grupo.', 'error');
    return;
  }
  if (!Number.isInteger(capacidad) || capacidad <= 0) {
    showToast('La capacidad máxima debe ser un número mayor a cero.', 'error');
    return;
  }
  if (!aula) {
    showToast('Selecciona un aula.', 'error');
    return;
  }
  if (!Number.isInteger(idSeccion) || idSeccion <= 0) {
    showToast('Selecciona una sección académica válida.', 'error');
    return;
  }
  if (!diasSemana.length) {
    showToast('Selecciona al menos un día de clase para el grupo.', 'error');
    return;
  }
  if (!horaInicio || !horaFin) {
    showToast('Indica la hora de inicio y la hora de finalización.', 'error');
    return;
  }
  if (horaFin <= horaInicio) {
    showToast('La hora de finalización debe ser posterior a la hora de inicio.', 'error');
    return;
  }

  const choqueLocal = allGrupos.find((g) =>
    String(g.aula || '') === String(aula) &&
    diasChocan(diasSemana, g.dias_semana) &&
    horariosChocan(horaInicio, horaFin, g.hora_inicio, g.hora_fin)
  );
  if (choqueLocal) {
    showToast(`${aula} ya está ocupada por ${choqueLocal.nombre_grupo || 'otro grupo'} en un horario que se cruza.`, 'error');
    return;
  }

  const payload = {
    nombre_grupo: nombre,
    capacidad,
    aula,
    id_seccion: idSeccion,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    dias_semana: diasSemana
  };

  const submitBtn = e.currentTarget?.querySelector('button[type="submit"]');
  const originalHtml = submitBtn?.innerHTML || 'Crear Grupo';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creando...';
  }

  try {
    const res = await apiFetch('/api/procesos/grupos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.mensaje || 'No se pudo crear el grupo.');

    showToast('Grupo creado correctamente.', 'success');
    e.currentTarget?.reset();
    const searchSeccion = document.getElementById('grupo-seccion-search');
    if (searchSeccion) searchSeccion.value = '';
    await populateGruposSelects();
    await populateSeccionesSelect();
    await actualizarDisponibilidadAulas('crear');
  } catch (error) {
    const mensaje = error?.message || 'Error de conexión al crear el grupo.';
    if (typeof showResultModal === 'function') showResultModal('error', 'No se pudo crear el grupo', mensaje);
    else showToast(mensaje, 'error');
  } finally {
    if (submitBtn?.isConnected) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
}

async function handleSeccionSubmit(e) {
  e.preventDefault();

  const nivel = normalizarParteSeccion(document.getElementById('seccion-nivel')?.value);
  const nombreEntrada = normalizarParteSeccion(document.getElementById('seccion-nombre')?.value).toUpperCase();
  const anioLectivo = parseInt(document.getElementById('seccion-periodo')?.value, 10);
  const nombre = construirNombreSeccion(nombreEntrada, nivel);
  const submitBtn = document.getElementById('btn-crear-seccion');
  const hint = document.getElementById('seccion-validation-hint');

  if (!/^[1-6]$/.test(nivel) || !/^[A-F]$/.test(nombreEntrada) || !Number.isInteger(anioLectivo) || anioLectivo < 2000 || anioLectivo > 2100) {
    showToast('Selecciona un grado, una letra válida y un año lectivo correcto.', 'error');
    return;
  }

  // La validación cliente evita el viaje innecesario; el backend repite la
  // validación para proteger también peticiones concurrentes.
  const duplicada = allSecciones.some((s) => {
    const existente = construirNombreSeccion(s?.nombre, s?.nivel).toUpperCase();
    return existente === nombre.toUpperCase() && Number(s?.anio_lectivo) === anioLectivo;
  });
  if (duplicada) {
    if (hint) {
      hint.textContent = `${nombre} (${anioLectivo}) ya está registrada.`;
      hint.classList.add('text-danger');
    }
    showToast(`La sección ${nombre} (${anioLectivo}) ya existe.`, 'warning');
    return;
  }

  const payload = {
    nombre,
    nivel,
    anio_lectivo: anioLectivo,
    descripcion: normalizarParteSeccion(document.getElementById('seccion-descripcion')?.value) || null
  };

  const original = submitBtn?.innerHTML || '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Creando…';
  }

  try {
    const res = await apiFetch('/api/procesos/secciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || json.mensaje || 'No se pudo crear la sección.');
    }

    showToast(`Sección ${nombre} creada correctamente.`, 'success');
    document.getElementById('seccion-form')?.reset();
    setDefaultSeccionPeriodo();
    if (hint) {
      hint.textContent = 'El sistema impedirá duplicados para el mismo año lectivo.';
      hint.classList.remove('text-danger');
    }

    await populateGruposSelects();
    await populateSeccionesSelect();
  } catch (error) {
    showToast(error.message || 'Error creando sección.', 'error');
  } finally {
    if (submitBtn?.isConnected) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original || '<i class="bi bi-plus-circle me-1"></i> Crear sección';
    }
  }
}

export { loadMatriculaData, populatePersonaSelects, populateGruposSelects, allGrupos };
