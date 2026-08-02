/* ==========================================
   MÓDULO DE ASISTENCIA 
   ========================================== */

let asistenciaChartInstance = null;

function wireAsistenciaEvents() {
  const asisForm = document.getElementById('asistencia-form');
  if (asisForm && !asisForm.dataset.wired) {
    asisForm.dataset.wired = '1';
    asisForm.addEventListener('submit', handleAsistenciaSubmit);
  }

  const modForm = document.getElementById('modificar-asistencia-form');
  if (modForm && !modForm.dataset.wired) {
    modForm.dataset.wired = '1';
    modForm.addEventListener('submit', handleModificarAsistenciaSubmit);
  }

  const asisGrupoSelEl = document.getElementById('asis-id-grupo');
  if (asisGrupoSelEl && !asisGrupoSelEl.dataset.wired) {
    asisGrupoSelEl.dataset.wired = '1';
    asisGrupoSelEl.addEventListener('change', cargarRosterGrupoAsistencia);
  }

  // --- Filtros del historial en cascada ---
  const histGrupoSel = document.getElementById('hist-filtro-grupo');
  if (histGrupoSel && !histGrupoSel.dataset.wired) {
    histGrupoSel.dataset.wired = '1';
    histGrupoSel.addEventListener('change', async () => {
      await poblarFiltroEstudiantesHistorial(histGrupoSel.value);
      cargarHistorialAsistencia();
    });
  }

  const histEstudianteSel = document.getElementById('hist-filtro-estudiante');
  if (histEstudianteSel && !histEstudianteSel.dataset.wired) {
    histEstudianteSel.dataset.wired = '1';
    histEstudianteSel.addEventListener('change', cargarHistorialAsistencia);
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
    histLimpiar.addEventListener('click', async () => {
      if (histGrupoSel) histGrupoSel.value = '';
      await poblarFiltroEstudiantesHistorial('');
      if (histEstudianteSel) histEstudianteSel.value = '';
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

  const hoyISO = new Date().toISOString().split('T')[0];
  const asisFechaInput = document.getElementById('asis-fecha');
  if (asisFechaInput) { asisFechaInput.max = hoyISO; if (!asisFechaInput.value) asisFechaInput.value = hoyISO; }
}

async function loadAsistenciaData() {
  await populateGruposSelects();
  await cargarRosterGrupoAsistencia();
  poblarFiltroGrupoHistorial();
  await poblarFiltroEstudiantesHistorial('');
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
    if ((detalle.profesores || []).length === 1) {
      profesorSel.value = detalle.profesores[0].id_profesor;
    }

    if (hint) {
      if ((detalle.estudiantes || []).length === 0) {
        hint.textContent = 'Este grupo no tiene estudiantes matriculados.';
        hint.classList.add('text-danger');
      } else {
        hint.textContent = '';
        hint.classList.remove('text-danger');
      }
    }
  } catch (error) {
    console.error('Error cargando roster del grupo', error);
  }
}

function poblarFiltroGrupoHistorial() {
  const sel = document.getElementById('hist-filtro-grupo');
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todos los grupos</option>';
  if (typeof allGrupos !== 'undefined') {
    allGrupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      sel.add(new Option(g.nombre_grupo ?? `Grupo ${id}`, id));
    });
  }
  sel.value = valorActual || '';
}

async function poblarFiltroEstudiantesHistorial(idGrupo) {
  const sel = document.getElementById('hist-filtro-estudiante');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos los estudiantes</option>';
  
  if (!idGrupo) {
    sel.disabled = false;
    return;
  }

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) return;
    const detalle = await res.json();
    (detalle.estudiantes || []).forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      sel.add(new Option(texto, e.id_estudiante));
    });
  } catch (e) {
    console.error('Error cargando estudiantes para filtro', e);
  }
}

async function cargarHistorialAsistencia() {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;

  const idGrupo = document.getElementById('hist-filtro-grupo')?.value || '';
  const idEstudiante = document.getElementById('hist-filtro-estudiante')?.value || '';
  const estado = document.getElementById('hist-filtro-estado')?.value || '';
  const fechaDesde = document.getElementById('hist-filtro-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('hist-filtro-fecha-hasta')?.value || '';
  const busqueda = document.getElementById('hist-filtro-busqueda')?.value.trim() || '';

  const params = new URLSearchParams();
  if (idGrupo) params.set('id_grupo', idGrupo);
  if (idEstudiante) params.set('id_estudiante', idEstudiante);
  if (estado) params.set('estado_asistencia', estado);
  if (fechaDesde) params.set('fecha_inicio', fechaDesde);
  if (fechaHasta) params.set('fecha_fin', fechaHasta);
  if (busqueda) params.set('busqueda', busqueda);

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Cargando historial...</td></tr>';

  try {
    const res = await apiFetch(`/api/procesos/asistencia?${params.toString()}`);
    if (!res.ok) throw new Error('No se pudo cargar el historial');
    const registros = await res.json();
    renderHistorialAsistencia(registros);
    actualizarGraficosAsistencia(registros);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar el historial.</td></tr>';
    actualizarGraficosAsistencia([]);
  }
}

function renderHistorialAsistencia(registros) {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!registros.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5">
          <i class="bi bi-calendar-x display-6 text-muted d-block mb-2"></i>
          <span class="text-muted">No hay registros de asistencia con estos filtros.</span>
        </td>
      </tr>
    `;
    actualizarGraficosAsistencia([]);
    return;
  }

  const etiquetasEstado = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };

  registros.forEach((r) => {
    const idAsis = r.id_asistencia ?? r.id;
    const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
    const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const estado = (r.estado_asistencia || '').toLowerCase();
    const etiqueta = etiquetasEstado[estado] || r.estado_asistencia || '-';
    const observaciones = r.observaciones ? r.observaciones : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td class="fw-semibold">${estudiante || '-'}</td>
      <td>${r.nombre_grupo ?? '-'}</td>
      <td>${profesor || '-'}</td>
      <td><span class="attendance-badge attendance-${estado}">${etiqueta}</span></td>
      <td class="observaciones-cell" title="${observaciones}">${observaciones}</td>
      <td class="text-end">
        <button type="button" class="btn btn-outline-primary btn-sm px-2 py-1 btn-modificar-asistencia" title="Modificar estado">
          <i class="bi bi-pencil-square"></i> Modificar
        </button>
      </td>
    `;
    
    const btnMod = tr.querySelector('.btn-modificar-asistencia');
    btnMod.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      abrirModalModificarAsistencia(idAsis, estudiante, estado, r.observaciones || '');
    });

    tbody.appendChild(tr);
  });

  actualizarGraficosAsistencia(registros);
}

function abrirModalModificarAsistencia(idAsistencia, estudianteNombre, estadoActual, observacionesActuales) {
  document.getElementById('mod-id-asistencia').value = idAsistencia;
  document.getElementById('mod-estudiante-nombre').value = estudianteNombre;
  document.getElementById('mod-estado').value = estadoActual;
  document.getElementById('mod-observaciones').value = observacionesActuales !== '—' ? observacionesActuales : '';
  
  const modalEl = document.getElementById('modalModificarAsistencia');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

async function handleModificarAsistenciaSubmit(e) {
  e.preventDefault();
  const idAsistencia = document.getElementById('mod-id-asistencia').value;
  const payload = {
    estado_asistencia: document.getElementById('mod-estado').value,
    observaciones: document.getElementById('mod-observaciones').value.trim() || null
  };

  const btn = document.getElementById('mod-submit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    const res = await apiFetch(`/api/procesos/asistencia/${idAsistencia}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Registro de asistencia actualizado correctamente');
      const modalEl = document.getElementById('modalModificarAsistencia');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      await cargarHistorialAsistencia();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.mensaje || err.error || 'No se pudo actualizar el registro', 'error');
    }
  } catch (e) {
    showToast('Error de conexión al actualizar asistencia', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-save"></i> Actualizar Registro'; }
  }
}

function actualizarGraficosAsistencia(registros) {
  const total = registros.length;
  const presentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'presente').length;
  const ausentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'ausente').length;
  const tardias = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'tardia').length;
  const justificadas = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'justificada').length;

  const elTotal = document.getElementById('graf-total');
  const elEfectiva = document.getElementById('graf-efectiva');
  const elAusentismo = document.getElementById('graf-ausentismo');

  if (elTotal) elTotal.textContent = total;
  const ef = total > 0 ? ((presentes / total) * 100).toFixed(1) : 0;
  const aus = total > 0 ? ((ausentes / total) * 100).toFixed(1) : 0;
  if (elEfectiva) elEfectiva.textContent = `${ef}%`;
  if (elAusentismo) elAusentismo.textContent = `${aus}%`;

  const ctx = document.getElementById('chartAsistenciaEstados');
  if (!ctx) return;

  if (asistenciaChartInstance) {
    asistenciaChartInstance.destroy();
  }

  if (typeof Chart !== 'undefined') {
    asistenciaChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Presentes', 'Ausentes', 'Tardías', 'Justificadas'],
        datasets: [{
          data: [presentes, ausentes, tardias, justificadas],
          backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  }
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
    
    if (res.ok) {
      showToast('Asistencia guardada correctamente');
      document.getElementById('asis-observaciones').value = '';
      personaSel.value = '';
      await cargarHistorialAsistencia();
    } else {
      const json = await res.json().catch(() => ({}));
      showToast(json.error || json.mensaje || 'Error guardando asistencia', 'error');
    }
  } catch {
    showToast('Error guardando asistencia', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Registro de Asistencia'; }
  }
}