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
let resizeTimer = null;

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseDays(value) {
  return [...new Set(String(value || '').split(',').map(normalizeText).filter(Boolean))];
}

function minutes(value) {
  const [h, m] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function fmtHour(value) {
  const [hRaw, mRaw] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  const h = Number.isFinite(hRaw) ? hRaw : 0;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
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

function wireHorarioEvents() {
  const professor = document.getElementById('horarios-profesor-filter');
  const group = document.getElementById('horarios-grupo-filter');
  const period = document.getElementById('horarios-periodo-filter');
  const clear = document.getElementById('horarios-limpiar');
  const refresh = document.getElementById('horarios-refrescar');

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
      refresh.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Actualizando...';
      try {
        await loadHorarios();
        showToast('Horarios actualizados.', 'success');
      } finally {
        refresh.disabled = false;
        refresh.innerHTML = original;
      }
    });
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
  if (board) board.innerHTML = '<div class="schedule-empty-state"><span class="spinner-border" aria-hidden="true"></span><strong>Cargando horarios...</strong></div>';

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
    renderHorarios();
  } catch (error) {
    if (board) board.innerHTML = `<div class="schedule-empty-state is-error"><i class="bi bi-exclamation-triangle"></i><strong>No se pudieron cargar los horarios</strong><span>${escapeHtml(error.message)}</span></div>`;
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
  if (subtitle) subtitle.textContent = isAdmin
    ? 'Consulta la agenda de todos los profesores y filtra por docente, grupo o período.'
    : 'Consulta únicamente tus grupos y horas de clase asignadas.';

  if (professor) {
    const previous = professor.value;
    professor.innerHTML = '<option value="">Todos los profesores</option>' + horarioData.profesores.map((p) =>
      `<option value="${p.id_profesor}">${escapeHtml(p.nombre)} · ${escapeHtml(p.materia || 'Sin materia')}</option>`
    ).join('');
    if (isAdmin && [...professor.options].some((o) => o.value === previous)) professor.value = previous;
  }

  if (period) {
    const previous = period.value;
    period.innerHTML = '<option value="">Todos los períodos</option>' + horarioData.periodos.map((p) =>
      `<option value="${p.anio}">${p.anio} · ${escapeHtml(String(p.estado || '').toLowerCase().replace(/^./, c => c.toUpperCase()))}</option>`
    ).join('');
    const next = previous && [...period.options].some((o) => o.value === previous) ? previous : pickDefaultPeriod();
    period.value = next;
  }

  syncGroupOptions();
}

function syncGroupOptions() {
  const professor = document.getElementById('horarios-profesor-filter');
  const group = document.getElementById('horarios-grupo-filter');
  if (!group) return;
  const previous = group.value;
  const professorId = currentRole() === 'administrador' ? Number(professor?.value || 0) : Number(currentUser?.id_profesor || window.EduControlCurrentUser?.id_profesor || 0);
  const periodValue = Number(document.getElementById('horarios-periodo-filter')?.value || 0);
  const allowed = horarioData.grupos.filter((g) => {
    if (periodValue && Number(g.periodo_lectivo) !== periodValue) return false;
    if (!professorId) return true;
    return horarioData.horarios.some((h) => Number(h.id_profesor) === professorId && Number(h.id_grupo) === Number(g.id_grupo));
  });
  group.innerHTML = '<option value="">Todos los grupos</option>' + allowed.map((g) =>
    `<option value="${g.id_grupo}">${escapeHtml(g.nombre_grupo)} · ${escapeHtml(g.nombre_seccion || g.nivel || '')} · ${g.periodo_lectivo}</option>`
  ).join('');
  if ([...group.options].some((o) => o.value === previous)) group.value = previous;
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
    board.innerHTML = '<div class="schedule-empty-state"><i class="bi bi-calendar-x"></i><strong>No hay clases asignadas con estos filtros.</strong><span>Prueba otro profesor, grupo o período lectivo.</span></div>';
    return;
  }

  const uniqueTeachers = new Set(rows.map((r) => Number(r.id_profesor))).size;
  const professorSelected = Boolean(document.getElementById('horarios-profesor-filter')?.value);
  const personal = currentRole() === 'profesor';
  const useTimeline = window.innerWidth >= 820 && (personal || professorSelected || uniqueTeachers === 1);
  board.innerHTML = useTimeline ? buildTimeline(rows) : buildAgenda(rows);
}

function renderStats(rows) {
  const assignments = new Set(rows.map((r) => `${r.id_profesor}:${r.id_grupo}`)).size;
  const teachers = new Set(rows.map((r) => r.id_profesor)).size;
  const rooms = new Set(rows.map((r) => r.aula).filter(Boolean)).size;
  const hours = rows.reduce((sum, r) => {
    const duration = Math.max(0, minutes(r.hora_fin) - minutes(r.hora_inicio)) / 60;
    return sum + duration * parseDays(r.dias_semana).length;
  }, 0);
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
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
  if (currentRole() === 'profesor' || teacherIds.length === 1) {
    const row = rows[0];
    if (kicker) kicker.textContent = 'Horario personal';
    if (title) title.textContent = row ? row.profesor_nombre : 'Mi horario';
    if (desc) desc.textContent = row ? `${row.materia} · ${teacherIds.length ? 'Clases ordenadas por hora y día.' : 'Sin asignaciones.'}` : '';
  } else {
    if (kicker) kicker.textContent = 'Vista institucional';
    if (title) title.textContent = 'Agenda de profesores';
    if (desc) desc.textContent = 'Las clases se ordenan por día y hora. Selecciona un profesor para abrir la línea de tiempo detallada.';
  }
}

function activeDays(rows) {
  const used = new Set(rows.flatMap((r) => parseDays(r.dias_semana)));
  const standard = DAY_META.slice(0, 5);
  if (used.has('sabado')) standard.push(DAY_META[5]);
  return standard;
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
    const items = rows.filter((r) => parseDays(r.dias_semana).includes(key)).sort((a, b) => minutes(a.hora_inicio) - minutes(b.hora_inicio));
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
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { start = 420; end = 1020; }
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
    const events = rows.filter((r) => parseDays(r.dias_semana).includes(key));
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
    ${days.map(([,label]) => `<div class="schedule-timeline-day-label">${label}</div>`).join('')}
    <div class="schedule-time-axis-wrap">${axis}</div>
    ${lanes}
  </div>`;
}

export { loadHorarios };
