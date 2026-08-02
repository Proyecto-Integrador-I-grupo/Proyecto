(function () {
  const moduleName = 'asistencia';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireAsistenciaEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE ASISTENCIA
   Registro diario y consulta del historial de asistencia por grupo.
   ========================================== */

function wireAsistenciaEvents() {
  const asisForm = document.getElementById('asistencia-form');
  if (asisForm && !asisForm.dataset.wired) {
    asisForm.dataset.wired = '1';
    asisForm.addEventListener('submit', handleAsistenciaSubmit);
  }

  const asisGrupoSelEl = document.getElementById('asis-id-grupo');
  if (asisGrupoSelEl && !asisGrupoSelEl.dataset.wired) {
    asisGrupoSelEl.dataset.wired = '1';
    asisGrupoSelEl.addEventListener('change', cargarRosterGrupoAsistencia);
  }

  // --- Filtros del historial de asistencia ---
  const histGrupoSel = document.getElementById('hist-filtro-grupo');
  if (histGrupoSel && !histGrupoSel.dataset.wired) {
    histGrupoSel.dataset.wired = '1';
    histGrupoSel.addEventListener('change', cargarHistorialAsistencia);
  }

  const histEstadoSel = document.getElementById('hist-filtro-estado');
  if (histEstadoSel && !histEstadoSel.dataset.wired) {
    histEstadoSel.dataset.wired = '1';
    histEstadoSel.addEventListener('change', cargarHistorialAsistencia);
  }

  const histDesde = document.getElementById('hist-filtro-fecha-desde');
  if (histDesde && !histDesde.dataset.wired) {
    histDesde.dataset.wired = '1';
    histDesde.addEventListener('change', cargarHistorialAsistencia);
  }

  const histHasta = document.getElementById('hist-filtro-fecha-hasta');
  if (histHasta && !histHasta.dataset.wired) {
    histHasta.dataset.wired = '1';
    histHasta.addEventListener('change', cargarHistorialAsistencia);
  }

  const histBusqueda = document.getElementById('hist-filtro-busqueda');
  if (histBusqueda && !histBusqueda.dataset.wired) {
    histBusqueda.dataset.wired = '1';
    let debounceTimer = null;
    histBusqueda.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(cargarHistorialAsistencia, 350);
    });
  }

  const histLimpiar = document.getElementById('hist-limpiar-filtros');
  if (histLimpiar && !histLimpiar.dataset.wired) {
    histLimpiar.dataset.wired = '1';
    histLimpiar.addEventListener('click', () => {
      if (histGrupoSel) histGrupoSel.value = '';
      if (histEstadoSel) histEstadoSel.value = '';
      if (histDesde) histDesde.value = '';
      if (histHasta) histHasta.value = '';
      if (histBusqueda) histBusqueda.value = '';
      cargarHistorialAsistencia();
    });
  }

  const histRefrescar = document.getElementById('hist-refrescar');
  if (histRefrescar && !histRefrescar.dataset.wired) {
    histRefrescar.dataset.wired = '1';
    histRefrescar.addEventListener('click', cargarHistorialAsistencia);
  }

  // Igual que en Matrícula: el trigger de BD rechaza fecha futura, así que
  // se limita también en el input para no dejar que el usuario ni lo intente.
  const hoyISO = new Date().toISOString().split('T')[0];
  const asisFechaInput = document.getElementById('asis-fecha');
  if (asisFechaInput) { asisFechaInput.max = hoyISO; if (!asisFechaInput.value) asisFechaInput.value = hoyISO; }
}

async function loadAsistenciaData() {
  await populateGruposSelects();
  // Si ya había un grupo elegido de una visita anterior a esta vista, refresca su roster;
  // si no, deja los selects de estudiante/profesor deshabilitados hasta que se elija uno.
  await cargarRosterGrupoAsistencia();
  poblarFiltroGrupoHistorial();
  await cargarHistorialAsistencia();
}

async function cargarRosterGrupoAsistencia() {
  const grupoSel = document.getElementById('asis-id-grupo');
  const personaSel = document.getElementById('asis-persona');
  const profesorSel = document.getElementById('asis-id-profesor');
  const hint = document.getElementById('asis-grupo-hint');
  if (!grupoSel || !personaSel || !profesorSel) return;

  const idGrupo = parseInt(grupoSel.value, 10);
  if (!idGrupo) {
    personaSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    profesorSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    personaSel.disabled = true;
    profesorSel.disabled = true;
    return;
  }

  personaSel.innerHTML = '<option value="" disabled selected>Cargando...</option>';
  profesorSel.innerHTML = '<option value="" disabled selected>Cargando...</option>';

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) throw new Error('No se pudo cargar el grupo');
    const detalle = await res.json();

    personaSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
    (detalle.estudiantes || []).forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      personaSel.add(new Option(texto, e.id_estudiante));
    });
    personaSel.disabled = (detalle.estudiantes || []).length === 0;

    profesorSel.innerHTML = '<option value="" disabled selected>Seleccionar profesor</option>';
    (detalle.profesores || []).forEach((p) => {
      const texto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} (${p.materia || 'General'})`.trim();
      profesorSel.add(new Option(texto, p.id_profesor));
    });
    profesorSel.disabled = (detalle.profesores || []).length === 0;
    // Si solo hay un profesor asignado al grupo (lo normal), se autoselecciona.
    if ((detalle.profesores || []).length === 1) {
      profesorSel.value = detalle.profesores[0].id_profesor;
    }

    if (hint) {
      if ((detalle.estudiantes || []).length === 0) {
        hint.textContent = 'Este grupo todavía no tiene estudiantes matriculados.';
        hint.classList.add('text-danger');
      } else if ((detalle.profesores || []).length === 0) {
        hint.textContent = 'Este grupo no tiene un profesor asignado activo.';
        hint.classList.add('text-danger');
      } else {
        hint.textContent = '';
        hint.classList.remove('text-danger');
      }
    }
  } catch (error) {
    console.error('Error cargando roster del grupo', error);
    personaSel.innerHTML = '<option value="" disabled selected>Error al cargar</option>';
    profesorSel.innerHTML = '<option value="" disabled selected>Error al cargar</option>';
  }
}

function poblarFiltroGrupoHistorial() {
  const sel = document.getElementById('hist-filtro-grupo');
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todos los grupos</option>';
  allGrupos.forEach((g) => {
    const id = g.id_grupo ?? g.id;
    sel.add(new Option(g.nombre_grupo ?? `Grupo ${id}`, id));
  });
  sel.value = valorActual || '';
}

async function cargarHistorialAsistencia() {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;

  const idGrupo = document.getElementById('hist-filtro-grupo')?.value || '';
  const estado = document.getElementById('hist-filtro-estado')?.value || '';
  const fechaDesde = document.getElementById('hist-filtro-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('hist-filtro-fecha-hasta')?.value || '';
  const busqueda = document.getElementById('hist-filtro-busqueda')?.value.trim() || '';

  const params = new URLSearchParams();
  if (idGrupo) params.set('id_grupo', idGrupo);
  if (estado) params.set('estado_asistencia', estado);
  if (fechaDesde) params.set('fecha_inicio', fechaDesde);
  if (fechaHasta) params.set('fecha_fin', fechaHasta);
  if (busqueda) params.set('busqueda', busqueda);

  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Cargando historial...</td></tr>';

  try {
    const res = await apiFetch(`/api/procesos/asistencia?${params.toString()}`);
    if (!res.ok) throw new Error('No se pudo cargar el historial de asistencia');
    const registros = await res.json();
    renderHistorialAsistencia(registros);
    actualizarStatsHistorial(registros);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Error al cargar el historial.</td></tr>';
    actualizarStatsHistorial([]);
    console.error('Error cargando historial de asistencia', error);
  }
}

function renderHistorialAsistencia(registros) {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!registros.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5">
          <i class="bi bi-calendar-x display-6 text-muted d-block mb-2"></i>
          <span class="text-muted">No hay registros de asistencia con estos filtros.</span>
        </td>
      </tr>
    `;
    return;
  }

  const etiquetasEstado = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };

  registros.forEach((r) => {
    const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
    const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const estado = (r.estado_asistencia || '').toLowerCase();
    const etiqueta = etiquetasEstado[estado] || r.estado_asistencia || '-';
    const observaciones = r.observaciones ? r.observaciones : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${estudiante || '-'}</td>
      <td>${r.nombre_grupo ?? '-'}</td>
      <td>${profesor || '-'}</td>
      <td><span class="attendance-badge attendance-${estado}">${etiqueta}</span></td>
      <td class="observaciones-cell" title="${observaciones}">${observaciones}</td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarStatsHistorial(registros) {
  const total = registros.length;
  const presentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'presente').length;
  const ausentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'ausente').length;
  const otros = total - presentes - ausentes; // tardía + justificada

  const setTexto = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setTexto('hist-stat-total', total);
  setTexto('hist-stat-presente', presentes);
  setTexto('hist-stat-ausente', ausentes);
  setTexto('hist-stat-otros', otros);
}

async function handleAsistenciaSubmit(e) {
  e.preventDefault();
  const grupoSel = document.getElementById('asis-id-grupo');
  const personaSel = document.getElementById('asis-persona');
  const profesorSel = document.getElementById('asis-id-profesor');

  if (!grupoSel.value || !personaSel.value || !profesorSel.value) {
    showToast('Selecciona grupo, estudiante y profesor.', 'error');
    return;
  }

  const payload = {
    fecha: document.getElementById('asis-fecha').value,
    estado_asistencia: document.getElementById('asis-estado').value,
    observaciones: document.getElementById('asis-observaciones').value.trim() || null,
    id_estudiante: parseInt(personaSel.value, 10),
    id_grupo: parseInt(grupoSel.value, 10),
    id_profesor: parseInt(profesorSel.value, 10)
  };

  const submitBtn = document.getElementById('asis-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    const res = await apiFetch('/api/procesos/asistencia', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Asistencia guardada correctamente');
      // Se conserva el grupo elegido (lo normal es pasar lista a varios
      // estudiantes seguidos del mismo grupo) y solo se limpian estudiante y observaciones.
      document.getElementById('asis-observaciones').value = '';
      personaSel.value = '';
      await cargarHistorialAsistencia();
    } else {
      showToast(json.error || json.mensaje || 'Error guardando asistencia', 'error');
    }
  } catch {
    showToast('Error guardando asistencia', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Asistencia'; }
  }
}