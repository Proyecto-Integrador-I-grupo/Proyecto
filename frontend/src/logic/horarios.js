import { apiFetch, currentUser, showToast } from './ui.js';

(function () {
  if (document.documentElement.dataset.horariosModalWired === '1') return;
  document.documentElement.dataset.horariosModalWired = '1';

  document.addEventListener('show.bs.modal', (event) => {
    if (event.target?.id !== 'modalHorarios') return;
    wireHorarioEvents();
    loadHorarios();
  });
})();

const DAY_META = [
  ['lunes', 'Lunes'],
  ['martes', 'Martes'],
  ['miercoles', 'Miércoles'],
  ['jueves', 'Jueves'],
  ['viernes', 'Viernes'],
  ['sabado', 'Sábado']
];

let horarioData = { horarios: [], profesores: [], grupos: [], periodos: [], alcance: 'personal' };
let editorBloques = [];
let editorCeldas = new Map();
let editorGrupoId = 0;
let editorDirty = false;
const EDITOR_SLOT_MINUTES = 30;
let resizeTimer = null;

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseDays(value) {
  return [...new Set(String(value || '').split(',').map(normalizeText).filter(Boolean))];
}

function normalizarHoraEscolar(value) {
  const [hRaw, mRaw] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  let h = Number.isFinite(hRaw) ? hRaw : 0;
  const m = Number.isFinite(mRaw) ? mRaw : 0;

  // En el contexto escolar, valores 01:00–05:59 representan la jornada de la tarde.
  // Así 01:00 se presenta/ordena como 1:00 p. m. y nunca aparece antes de 8:00 a. m.
  if (h >= 1 && h <= 5) h += 12;

  return { h, m };
}

function minutes(value) {
  const { h, m } = normalizarHoraEscolar(value);
  return h * 60 + m;
}

function fmtHour(value) {
  const { h, m } = normalizarHoraEscolar(value);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function currentRole() {
  return String(currentUser?.rol || window.EduControlCurrentUser?.rol || '').trim().toLowerCase();
}

function buildEmptyState({ icon = 'bi-calendar-x', title, description = '', tips = [], error = false, loading = false } = {}) {
  const tipItems = Array.isArray(tips) && tips.length
    ? `<ul class="schedule-empty-tips">${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`
    : '';

  return `<div class="schedule-empty-state ${error ? 'is-error' : ''} ${loading ? 'is-loading' : ''}">
    ${loading ? '<span class="spinner-border" aria-hidden="true"></span>' : `<i class="bi ${icon}"></i>`}
    <strong>${escapeHtml(title || 'Sin información disponible')}</strong>
    ${description ? `<span>${escapeHtml(description)}</span>` : ''}
    ${tipItems}
  </div>`;
}

function wireHorarioEvents() {
  const professor = document.getElementById('horarios-profesor-filter');
  const group = document.getElementById('horarios-grupo-filter');
  const period = document.getElementById('horarios-periodo-filter');
  const clear = document.getElementById('horarios-limpiar');
  const refresh = document.getElementById('horarios-refrescar');
  const editorToggle = document.getElementById('horarios-editor-toggle');
  const editorClose = document.getElementById('horarios-editor-close');
  const editorGrupo = document.getElementById('horarios-editor-grupo');
  const editorGuardar = document.getElementById('horarios-editor-guardar');
  const editorEliminarTodo = document.getElementById('horarios-editor-eliminar-todo');
  const editorWeek = document.getElementById('horarios-editor-week');

  [professor, group, period].forEach((el) => {
    if (!el || el.dataset.wired === '1') return;
    el.dataset.wired = '1';
    el.addEventListener('change', () => {
      if (el === professor || el === period) syncGroupOptions();
      renderHorarios();
    });
  });

  if (clear && clear.dataset.wired !== '1') {
    clear.dataset.wired = '1';
    clear.addEventListener('click', () => {
      if (professor) professor.value = '';
      if (group) group.value = '';
      if (period) period.value = pickDefaultPeriod();
      syncGroupOptions();
      renderHorarios();
    });
  }

  if (refresh && refresh.dataset.wired !== '1') {
    refresh.dataset.wired = '1';
    refresh.addEventListener('click', async () => {
      const original = refresh.innerHTML;
      refresh.disabled = true;
      refresh.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span><span>Actualizando...</span>';
      try {
        const editorAbierto = !document.getElementById('horarios-editor-card')?.classList.contains('hidden');
        if (editorAbierto && editorGrupoId && editorDirty) {
          await guardarEditorGrupo();
        } else {
          await loadHorarios();
        }
        showToast('Horarios actualizados.', 'success');
      } finally {
        refresh.disabled = false;
        refresh.innerHTML = original;
      }
    });
  }


  if (editorToggle && editorToggle.dataset.wired !== '1') {
    editorToggle.dataset.wired = '1';
    editorToggle.addEventListener('click', () => {
      const card = document.getElementById('horarios-editor-card');
      card?.classList.remove('hidden');
      document.getElementById('modalHorarios')?.classList.add('schedule-editor-open');
      setTimeout(() => document.getElementById('horarios-editor-grupo')?.focus(), 0);
    });
  }

  if (editorClose && editorClose.dataset.wired !== '1') {
    editorClose.dataset.wired = '1';
    editorClose.addEventListener('click', () => {
      document.getElementById('horarios-editor-card')?.classList.add('hidden');
      document.getElementById('modalHorarios')?.classList.remove('schedule-editor-open');
    });
  }

  if (editorGrupo && editorGrupo.dataset.wired !== '1') {
    editorGrupo.dataset.wired = '1';
    editorGrupo.addEventListener('change', () => cargarEditorGrupo(Number(editorGrupo.value || 0)));
  }

  if (editorGuardar && editorGuardar.dataset.wired !== '1') {
    editorGuardar.dataset.wired = '1';
    editorGuardar.addEventListener('click', guardarEditorGrupo);
  }

  if (editorEliminarTodo && editorEliminarTodo.dataset.wired !== '1') {
    editorEliminarTodo.dataset.wired = '1';
    editorEliminarTodo.addEventListener('click', eliminarTodoHorarioGrupo);
  }

  if (editorWeek && editorWeek.dataset.wired !== '1') {
    editorWeek.dataset.wired = '1';
    editorWeek.addEventListener('change', (event) => {
      const select = event.target.closest('[data-schedule-cell]');
      if (!select) return;
      const key = String(select.dataset.scheduleCell || '');
      const materia = String(select.value || '').trim();
      if (!key) return;
      if (materia) editorCeldas.set(key, materia);
      else editorCeldas.delete(key);
      editorDirty = true;
      renderEditorCoverage();
      select.classList.toggle('has-subject', Boolean(materia));
    });
  }


  if (document.documentElement.dataset.horariosEditorEscapeWired !== '1') {
    document.documentElement.dataset.horariosEditorEscapeWired = '1';
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const card = document.getElementById('horarios-editor-card');
      if (!card || card.classList.contains('hidden')) return;
      event.preventDefault();
      event.stopPropagation();
      card.classList.add('hidden');
      document.getElementById('modalHorarios')?.classList.remove('schedule-editor-open');
    }, true);
  }

  if (document.documentElement.dataset.horariosResizeWired !== '1') {
    document.documentElement.dataset.horariosResizeWired = '1';
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (document.getElementById('modalHorarios')?.classList.contains('show')) renderHorarios();
      }, 160);
    });
  }
}

function pickDefaultPeriod() {
  const active = horarioData.periodos.find((p) => String(p.estado).toUpperCase() === 'ACTIVO');
  return active ? String(active.anio) : (horarioData.periodos[0] ? String(horarioData.periodos[0].anio) : '');
}

async function loadHorarios() {
  const board = document.getElementById('horarios-board');
  if (board) {
    board.innerHTML = buildEmptyState({
      title: 'Cargando horarios...',
      description: 'Espera un momento mientras consultamos las asignaciones activas del sistema.',
      loading: true
    });
  }

  try {
    const res = await apiFetch('/api/profesores/horarios');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.mensaje || 'No se pudieron cargar los horarios.');
    horarioData = {
      horarios: Array.isArray(json.horarios) ? json.horarios : [],
      profesores: Array.isArray(json.profesores) ? json.profesores : [],
      grupos: Array.isArray(json.grupos) ? json.grupos : [],
      periodos: Array.isArray(json.periodos) ? json.periodos : [],
      alcance: json.alcance || 'personal'
    };
    populateFilters();
    populateScheduleEditorGroups();
    renderHorarios();
  } catch (error) {
    if (board) {
      board.innerHTML = buildEmptyState({
        icon: 'bi-exclamation-triangle',
        title: 'No se pudieron cargar los horarios',
        description: error.message,
        tips: ['Verifica tu sesión', 'Reintenta con el botón Actualizar', 'Confirma que existan asignaciones activas'],
        error: true
      });
    }
  }
}

function populateFilters() {
  const isAdmin = currentRole() === 'administrador';
  const professorField = document.getElementById('horarios-profesor-field');
  const professor = document.getElementById('horarios-profesor-filter');
  const group = document.getElementById('horarios-grupo-filter');
  const period = document.getElementById('horarios-periodo-filter');
  const subtitle = document.getElementById('horarios-subtitle');

  professorField?.classList.toggle('hidden', !isAdmin);
  document.getElementById('horarios-editor-toggle')?.classList.toggle('hidden', !isAdmin);
  if (!isAdmin) document.getElementById('horarios-editor-card')?.classList.add('hidden');
  if (subtitle) {
    subtitle.textContent = isAdmin
      ? 'Consulta la agenda completa y filtra por docente, grupo o período lectivo.'
      : 'Consulta únicamente tus grupos, aulas y horas de clase asignadas.';
  }

  if (professor) {
    const previous = professor.value;
    professor.innerHTML = '<option value="">Todos los profesores</option>' + horarioData.profesores.map((p) =>
      `<option value="${p.id_profesor}">${escapeHtml(p.nombre)} · ${escapeHtml(p.materia || 'Sin materia')}</option>`
    ).join('');
    if (isAdmin && [...professor.options].some((o) => o.value === previous)) {
      professor.value = previous;
    }
  }

  if (period) {
    const previous = period.value;
    period.innerHTML = '<option value="">Todos los períodos</option>' + horarioData.periodos.map((p) =>
      `<option value="${p.anio}">${p.anio} · ${escapeHtml(String(p.estado || '').toLowerCase().replace(/^./, (c) => c.toUpperCase()))}</option>`
    ).join('');
    const next = previous && [...period.options].some((o) => o.value === previous) ? previous : pickDefaultPeriod();
    period.value = next;
  }

  if (group && !group.dataset.placeholderApplied) {
    group.dataset.placeholderApplied = '1';
    group.innerHTML = '<option value="">Todos los grupos</option>';
  }

  syncGroupOptions();
}

function syncGroupOptions() {
  const professor = document.getElementById('horarios-profesor-filter');
  const group = document.getElementById('horarios-grupo-filter');
  if (!group) return;

  const previous = group.value;
  const professorId = currentRole() === 'administrador'
    ? Number(professor?.value || 0)
    : Number(currentUser?.id_profesor || window.EduControlCurrentUser?.id_profesor || 0);
  const periodValue = Number(document.getElementById('horarios-periodo-filter')?.value || 0);

  const allowed = horarioData.grupos.filter((g) => {
    if (periodValue && Number(g.periodo_lectivo) !== periodValue) return false;
    if (!professorId) return true;
    return horarioData.horarios.some((h) => Number(h.id_profesor) === professorId && Number(h.id_grupo) === Number(g.id_grupo));
  });

  group.innerHTML = '<option value="">Todos los grupos</option>' + allowed.map((g) =>
    `<option value="${g.id_grupo}">${escapeHtml(g.nombre_grupo)} · ${escapeHtml(g.nombre_seccion || g.nivel || '')} · ${g.periodo_lectivo}</option>`
  ).join('');

  if ([...group.options].some((o) => o.value === previous)) {
    group.value = previous;
  }
}


function populateScheduleEditorGroups() {
  const select = document.getElementById('horarios-editor-grupo');
  if (!select || currentRole() !== 'administrador') return;
  const previous = select.value;
  select.innerHTML = '<option value="">Seleccionar grupo</option>' + horarioData.grupos.map((g) => {
    const seccion = g.nombre_seccion || g.nivel || '';
    const periodo = g.periodo_lectivo ? ` · ${g.periodo_lectivo}` : '';
    return `<option value="${g.id_grupo}">${escapeHtml(g.nombre_grupo)} · ${escapeHtml(seccion)}${periodo}</option>`;
  }).join('');
  if (previous && [...select.options].some((o) => o.value === previous)) {
    select.value = previous;
  } else if (editorGrupoId && [...select.options].some((o) => Number(o.value) === Number(editorGrupoId))) {
    select.value = String(editorGrupoId);
  }
}

function getEditorGrupo() {
  const id = Number(document.getElementById('horarios-editor-grupo')?.value || editorGrupoId || 0);
  return horarioData.grupos.find((g) => Number(g.id_grupo) === id) || null;
}

function labelDia(key) {
  return DAY_META.find(([k]) => k === key)?.[1] || key;
}

function editorMateriaSet() {
  return ['Español','Matemáticas','Ciencias','Estudios Sociales','Inglés','Educación Física','Informática','Artes'];
}

function parseClockMinutes(value) {
  const raw = String(value || '').slice(0, 5);
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

function clockFromMinutes(total) {
  const safe = Math.max(0, Math.min(1439, Number(total) || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function editorWindow(grupo) {
  let inicio = parseClockMinutes(grupo?.hora_inicio);
  let fin = parseClockMinutes(grupo?.hora_fin);
  if (inicio == null || fin == null) return null;
  // Compatibilidad con grupos antiguos donde 04:30 significaba 4:30 p. m.
  if (fin <= inicio && fin <= 5 * 60 + 59) fin += 12 * 60;
  if (fin <= inicio) return null;
  return { inicio, fin };
}

function editorSlotRows(grupo) {
  const window = editorWindow(grupo);
  if (!window) return [];
  const rows = [];
  for (let start = window.inicio; start < window.fin; start += EDITOR_SLOT_MINUTES) {
    const end = Math.min(start + EDITOR_SLOT_MINUTES, window.fin);
    if (end <= start) break;
    rows.push({ inicio: clockFromMinutes(start), fin: clockFromMinutes(end) });
  }
  return rows;
}

function editorCellKey(day, start) {
  return `${normalizeText(day)}|${String(start || '').slice(0,5)}`;
}

function expandirBloquesACeldas(grupo, bloques) {
  const slots = editorSlotRows(grupo);
  const dias = parseDays(grupo?.dias_semana);
  const map = new Map();
  for (const day of dias) {
    for (const slot of slots) {
      const slotStart = parseClockMinutes(slot.inicio);
      const slotEnd = parseClockMinutes(slot.fin);
      const block = bloques.find((b) => {
        if (normalizeText(b.dia_semana) !== day) return false;
        const bStart = parseClockMinutes(b.hora_inicio);
        const bEnd = parseClockMinutes(b.hora_fin);
        return bStart != null && bEnd != null && slotStart >= bStart && slotEnd <= bEnd;
      });
      if (block?.materia) map.set(editorCellKey(day, slot.inicio), block.materia);
    }
  }
  return map;
}

function compilarCeldasABloques(grupo) {
  const dias = parseDays(grupo?.dias_semana);
  const slots = editorSlotRows(grupo);
  const bloques = [];
  for (const day of dias) {
    let current = null;
    for (const slot of slots) {
      const materia = editorCeldas.get(editorCellKey(day, slot.inicio)) || '';
      if (!materia) {
        if (current) { bloques.push(current); current = null; }
        continue;
      }
      if (current && current.materia === materia && current.hora_fin === slot.inicio) {
        current.hora_fin = slot.fin;
      } else {
        if (current) bloques.push(current);
        current = { dia_semana: day, hora_inicio: slot.inicio, hora_fin: slot.fin, materia };
      }
    }
    if (current) bloques.push(current);
  }
  return bloques;
}

async function cargarEditorGrupo(idGrupo) {
  editorGrupoId = Number(idGrupo || 0);
  editorBloques = [];
  editorCeldas = new Map();
  editorDirty = false;
  const controls = document.getElementById('horarios-editor-controls');
  const coverage = document.getElementById('horarios-editor-coverage');
  const actions = document.getElementById('horarios-editor-actions');
  const info = document.getElementById('horarios-editor-group-info');

  if (!editorGrupoId) {
    controls?.classList.add('hidden');
    coverage?.classList.add('hidden');
    actions?.classList.add('hidden');
    if (info) info.textContent = 'Selecciona un grupo para cargar sus días y su jornada.';
    renderEditorHorario();
    return;
  }

  const grupo = getEditorGrupo();
  if (!grupo) return;
  const dias = parseDays(grupo.dias_semana);
  const window = editorWindow(grupo);
  if (!window) {
    controls?.classList.add('hidden');
    actions?.classList.add('hidden');
    if (info) info.textContent = 'El grupo no tiene una jornada válida. Edita primero sus horas.';
    return showToast('El grupo no tiene una jornada válida para construir el horario.', 'error');
  }

  controls?.classList.remove('hidden');
  coverage?.classList.remove('hidden');
  actions?.classList.remove('hidden');
  if (info) {
    info.innerHTML = `<strong>${escapeHtml(grupo.nombre_grupo)}</strong><span>${dias.map(labelDia).join(', ')} · Jornada ${escapeHtml(clockFromMinutes(window.inicio))}–${escapeHtml(clockFromMinutes(window.fin))} · ${escapeHtml(grupo.aula || 'Sin aula')}</span>`;
  }

  const week = document.getElementById('horarios-editor-week');
  if (week) week.innerHTML = buildEmptyState({ title: 'Cargando horario...', loading: true });

  try {
    const res = await apiFetch(`/api/procesos/grupos/${editorGrupoId}/horario`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.mensaje || 'No se pudo cargar el horario del grupo.');
    editorBloques = Array.isArray(json.bloques) ? json.bloques.map((b) => ({
      dia_semana: normalizeText(b.dia_semana),
      hora_inicio: String(b.hora_inicio || '').slice(0,5),
      hora_fin: String(b.hora_fin || '').slice(0,5),
      materia: String(b.materia || '').trim()
    })) : [];
    editorCeldas = expandirBloquesACeldas(grupo, editorBloques);
    editorDirty = false;
    renderEditorHorario();
  } catch (error) {
    showToast(error.message || 'No se pudo cargar el horario del grupo.', 'error');
    renderEditorHorario();
  }
}

function renderEditorCoverage() {
  const coverage = document.getElementById('horarios-editor-coverage');
  if (!coverage) return;
  const materias = editorMateriaSet();
  const cubiertas = new Set([...editorCeldas.values()].filter(Boolean));
  const faltantes = materias.filter((m) => !cubiertas.has(m));
  coverage.classList.remove('hidden');
  coverage.innerHTML = `<strong>${cubiertas.size}/8 materias programadas</strong><span>${faltantes.length ? `Pendientes: ${escapeHtml(faltantes.join(', '))}` : 'Las 8 materias tienen al menos un bloque semanal.'}</span>`;
}

function materiaOptions(selected = '') {
  return `<option value="">Libre</option>` + editorMateriaSet().map((m) =>
    `<option value="${escapeHtml(m)}" ${m === selected ? 'selected' : ''}>${escapeHtml(m)}</option>`
  ).join('');
}

function renderEditorHorario() {
  const week = document.getElementById('horarios-editor-week');
  const coverage = document.getElementById('horarios-editor-coverage');
  if (!week) return;
  const grupo = getEditorGrupo();
  if (!grupo) {
    week.innerHTML = '';
    coverage?.classList.add('hidden');
    return;
  }

  const dias = parseDays(grupo.dias_semana);
  const rows = editorSlotRows(grupo);
  renderEditorCoverage();
  if (!dias.length || !rows.length) {
    week.innerHTML = buildEmptyState({
      icon: 'bi-calendar2-x',
      title: 'No se puede construir este horario',
      description: 'El grupo necesita al menos un día y una jornada válida.'
    });
    return;
  }

  week.innerHTML = `<div class="schedule-grid-shell">
    <div class="schedule-grid-note"><i class="bi bi-cursor"></i> Selecciona una materia en cada celda. Deja “Libre” para recreos, almuerzo o espacios sin clase.</div>
    <div class="schedule-grid-scroll">
      <table class="schedule-planner-grid" aria-label="Planificador semanal del grupo">
        <thead><tr><th class="schedule-grid-time-head">Hora</th>${dias.map((day) => `<th>${escapeHtml(labelDia(day))}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((slot) => `<tr>
          <th class="schedule-grid-time"><strong>${escapeHtml(fmtHour(slot.inicio))}</strong><span>${escapeHtml(fmtHour(slot.fin))}</span></th>
          ${dias.map((day) => {
            const key = editorCellKey(day, slot.inicio);
            const selected = editorCeldas.get(key) || '';
            return `<td><select class="form-select schedule-grid-select ${selected ? 'has-subject' : ''}" data-schedule-cell="${escapeHtml(key)}" aria-label="${escapeHtml(labelDia(day))} ${escapeHtml(slot.inicio)} a ${escapeHtml(slot.fin)}">${materiaOptions(selected)}</select></td>`;
          }).join('')}
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

async function guardarEditorGrupo() {
  const grupo = getEditorGrupo();
  if (!grupo) return showToast('Selecciona un grupo.', 'error');
  const bloques = compilarCeldasABloques(grupo);
  const btn = document.getElementById('horarios-editor-guardar');
  const original = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
  }
  try {
    const res = await apiFetch(`/api/procesos/grupos/${grupo.id_grupo}/horario`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ bloques })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.mensaje || 'No se pudo guardar el horario.');
    editorBloques = bloques;
    editorDirty = false;
    showToast(bloques.length ? `Horario guardado: ${bloques.length} bloque${bloques.length === 1 ? '' : 's'} académico${bloques.length === 1 ? '' : 's'}.` : 'Horario vaciado correctamente.', 'success');

    // Conservar la selección del usuario y refrescar inmediatamente la agenda docente.
    const profesorActual = document.getElementById('horarios-profesor-filter')?.value || '';
    const grupoFiltroActual = document.getElementById('horarios-grupo-filter')?.value || '';
    const periodoActual = document.getElementById('horarios-periodo-filter')?.value || '';

    await loadHorarios();

    const professorFilter = document.getElementById('horarios-profesor-filter');
    const periodFilter = document.getElementById('horarios-periodo-filter');
    if (professorFilter && [...professorFilter.options].some((o) => o.value === profesorActual)) professorFilter.value = profesorActual;
    if (periodFilter && [...periodFilter.options].some((o) => o.value === periodoActual)) periodFilter.value = periodoActual;
    syncGroupOptions();
    const groupFilter = document.getElementById('horarios-grupo-filter');
    if (groupFilter && [...groupFilter.options].some((o) => o.value === grupoFiltroActual)) groupFilter.value = grupoFiltroActual;

    const select = document.getElementById('horarios-editor-grupo');
    if (select) select.value = String(grupo.id_grupo);
    await cargarEditorGrupo(Number(grupo.id_grupo));
    renderHorarios();
  } catch (error) {
    console.error('Error guardando horario académico:', error);
    showToast(error.message || 'No se pudo guardar el horario.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }
}

async function eliminarTodoHorarioGrupo() {
  const grupo = getEditorGrupo();
  if (!grupo) return showToast('Selecciona un grupo.', 'error');
  if (!editorCeldas.size && !editorBloques.length) {
    return showToast('Este grupo ya no tiene materias programadas.', 'info');
  }
  if (!window.confirm(`¿Eliminar todo el horario académico de ${grupo.nombre_grupo}? Esta acción vaciará todas las materias programadas del grupo.`)) return;

  editorCeldas = new Map();
  editorDirty = true;
  renderEditorHorario();
  await guardarEditorGrupo();
}

function getFilteredRows() {
  const professorId = Number(document.getElementById('horarios-profesor-filter')?.value || 0);
  const groupId = Number(document.getElementById('horarios-grupo-filter')?.value || 0);
  const period = Number(document.getElementById('horarios-periodo-filter')?.value || 0);
  return horarioData.horarios.filter((h) => {
    if (professorId && Number(h.id_profesor) !== professorId) return false;
    if (groupId && Number(h.id_grupo) !== groupId) return false;
    if (period && Number(h.periodo_lectivo) !== period) return false;
    return true;
  });
}

function renderHorarios() {
  const rows = getFilteredRows();
  renderStats(rows);
  renderHeading(rows);
  const board = document.getElementById('horarios-board');
  if (!board) return;

  if (!rows.length) {
    const hasAnyAssignments = Array.isArray(horarioData.horarios) && horarioData.horarios.length > 0;
    board.innerHTML = hasAnyAssignments
      ? buildEmptyState({
          icon: 'bi-funnel',
          title: 'No hay clases asignadas con estos filtros',
          description: 'Prueba otro profesor, grupo o período lectivo para encontrar coincidencias.',
          tips: ['Limpia los filtros', 'Selecciona un período activo', 'Prueba con otro grupo']
        })
      : buildEmptyState({
          icon: 'bi-calendar2-x',
          title: 'Aún no hay asignaciones horarias registradas',
          description: 'Cuando se asignen profesores a grupos con días y horas definidos, la agenda aparecerá en esta ventana.',
          tips: ['Crea un grupo con horario', 'Asigna el grupo a un profesor', 'Verifica el período lectivo activo']
        });
    return;
  }

  const ordenadas = [...rows].sort(compararHorarios);
  board.innerHTML = buildAgenda(ordenadas);
}

function renderStats(rows) {
  const assignments = new Set(rows.map((r) => `${r.id_profesor}:${r.id_grupo}`)).size;
  const teachers = new Set(rows.map((r) => r.id_profesor)).size;
  const rooms = new Set(rows.map((r) => r.aula).filter(Boolean)).size;
  const hours = rows.reduce((sum, r) => {
    const duration = Math.max(0, minutes(r.hora_fin) - minutes(r.hora_inicio)) / 60;
    return sum + duration * parseDays(r.dias_semana).length;
  }, 0);
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set('horarios-stat-asignaciones', String(assignments));
  set('horarios-stat-profesores', String(teachers));
  set('horarios-stat-horas', `${hours.toLocaleString('es-CR', { maximumFractionDigits: 1 })} h`);
  set('horarios-stat-aulas', String(rooms));
}

function renderHeading(rows) {
  const title = document.getElementById('horarios-board-title');
  const desc = document.getElementById('horarios-board-description');
  const kicker = document.getElementById('horarios-board-kicker');
  const teacherIds = [...new Set(rows.map((r) => Number(r.id_profesor)))];
  const uniqueGroups = [...new Set(rows.map((r) => Number(r.id_grupo)))].filter(Boolean).length;

  if (currentRole() === 'profesor' || teacherIds.length === 1) {
    const row = rows[0];
    if (kicker) kicker.textContent = 'Horario personal';
    if (title) title.textContent = row ? row.profesor_nombre : 'Mi horario';
    if (desc) {
      desc.textContent = row
        ? `${row.materia} · ${rows.length} clase(s) visibles en ${uniqueGroups} grupo(s).`
        : 'Sin asignaciones visibles.';
    }
    return;
  }

  if (kicker) kicker.textContent = 'Vista institucional';
  if (title) title.textContent = 'Agenda de profesores';
  if (desc) {
    desc.textContent = rows.length
      ? `${teacherIds.length} profesor(es) y ${uniqueGroups} grupo(s) visibles en la consulta actual.`
      : 'Selecciona un profesor para abrir la línea de tiempo detallada.';
  }
}

function compararHorarios(a, b) {
  const inicio = minutes(a.hora_inicio) - minutes(b.hora_inicio);
  if (inicio !== 0) return inicio;
  const fin = minutes(a.hora_fin) - minutes(b.hora_fin);
  if (fin !== 0) return fin;
  return String(a.nombre_grupo || '').localeCompare(String(b.nombre_grupo || ''), 'es');
}

function activeDays(rows) {
  const used = new Set(rows.flatMap((r) => parseDays(r.dias_semana)));
  return DAY_META.filter(([key]) => used.has(key));
}

function eventCard(row, compact = false) {
  const substitute = Boolean(Number(row.es_suplencia));
  return `<article class="schedule-class-card ${substitute ? 'is-substitute' : ''} ${compact ? 'is-compact' : ''}">
    <div class="schedule-class-time"><i class="bi bi-clock"></i>${fmtHour(row.hora_inicio)} – ${fmtHour(row.hora_fin)}</div>
    <strong>${escapeHtml(row.materia || 'Curso')}</strong>
    <span class="schedule-class-group">${escapeHtml(row.nombre_grupo)} · ${escapeHtml(row.nombre_seccion || row.nivel || 'Sección')}</span>
    ${compact ? `<span class="schedule-class-teacher"><i class="bi bi-person"></i>${escapeHtml(row.profesor_nombre)}</span>` : ''}
    <span class="schedule-class-meta"><i class="bi bi-door-open"></i>${escapeHtml(row.aula || 'Sin aula')}${substitute ? ' · Sustitución' : ''}</span>
  </article>`;
}

function buildAgenda(rows) {
  const days = activeDays(rows);
  return `<div class="schedule-agenda-week">${days.map(([key, label]) => {
    const items = rows.filter((r) => parseDays(r.dias_semana).includes(key)).sort(compararHorarios);
    return `<section class="schedule-agenda-day">
      <header><span>${label}</span><small>${items.length} ${items.length === 1 ? 'clase' : 'clases'}</small></header>
      <div class="schedule-agenda-list">${items.length ? items.map((r) => eventCard(r, true)).join('') : '<div class="schedule-day-empty">Sin clases</div>'}</div>
    </section>`;
  }).join('')}</div>`;
}

function buildTimeline(rows) {
  const days = activeDays(rows);
  const starts = rows.map((r) => minutes(r.hora_inicio));
  const ends = rows.map((r) => minutes(r.hora_fin));
  let start = Math.floor(Math.min(...starts) / 60) * 60;
  let end = Math.ceil(Math.max(...ends) / 60) * 60;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    start = 420;
    end = 1020;
  }
  start = Math.max(300, start - 60);
  end = Math.min(1320, end + 60);
  const rowHeight = 48;
  const totalHeight = ((end - start) / 60) * rowHeight;

  const labels = [];
  for (let t = start; t <= end; t += 60) labels.push(t);
  const axis = `<div class="schedule-time-axis" style="height:${totalHeight}px">${labels.map((t) => {
    const top = ((t - start) / 60) * rowHeight;
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    return `<span style="top:${top}px">${fmtHour(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)}</span>`;
  }).join('')}</div>`;

  const lanes = days.map(([key]) => {
    const events = rows.filter((r) => parseDays(r.dias_semana).includes(key)).sort(compararHorarios);
    const eventsHtml = events.map((r) => {
      const top = ((minutes(r.hora_inicio) - start) / 60) * rowHeight;
      const height = Math.max(48, ((minutes(r.hora_fin) - minutes(r.hora_inicio)) / 60) * rowHeight - 6);
      const substitute = Boolean(Number(r.es_suplencia));
      return `<article class="schedule-timeline-event ${substitute ? 'is-substitute' : ''}" style="top:${Math.max(0, top)}px;height:${height}px">
        <span class="schedule-event-time">${fmtHour(r.hora_inicio)} – ${fmtHour(r.hora_fin)}</span>
        <strong>${escapeHtml(r.materia || 'Curso')}</strong>
        <span>${escapeHtml(r.nombre_grupo)} · ${escapeHtml(r.nombre_seccion || r.nivel || '')}</span>
        <small><i class="bi bi-door-open"></i> ${escapeHtml(r.aula || 'Sin aula')}${substitute ? ' · Sustitución' : ''}</small>
      </article>`;
    }).join('');
    return `<div class="schedule-timeline-lane-wrap"><div class="schedule-day-lane" style="height:${totalHeight}px;background-size:100% ${rowHeight}px">${eventsHtml}</div></div>`;
  }).join('');

  return `<div class="schedule-timeline-shell" style="--schedule-days:${days.length}">
    <div class="schedule-timeline-corner">Hora</div>
    ${days.map(([, label]) => `<div class="schedule-timeline-day-label">${label}</div>`).join('')}
    <div class="schedule-time-axis-wrap">${axis}</div>
    ${lanes}
  </div>`;
}

export { loadHorarios };
