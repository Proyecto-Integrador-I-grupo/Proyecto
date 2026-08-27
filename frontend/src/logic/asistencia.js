import { apiFetch, currentUser, showToast, showResultModal } from './ui.js';

const ESTADOS = ['', 'presente', 'ausente', 'tardia', 'justificada'];
const ETIQUETAS = {
  presente: 'P',
  ausente: 'A',
  tardia: 'T',
  justificada: 'J'
};

let grupoActual = null;
let detalleGrupo = null;
let registrosMes = [];
let cambiosPendientes = new Map();
let historialCompleto = [];

(function registerModule() {
  const moduleName = 'asistencia';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init: wireAsistenciaEvents,
    load: loadAsistenciaData
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

function rolActual() {
  return String(currentUser?.rol || '').toLowerCase().trim();
}

function puedeEditar() {
  return ['administrador', 'profesor'].includes(rolActual());
}

function esAdmin() {
  return rolActual() === 'administrador';
}

function mesActualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function hoyLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function wireAsistenciaEvents() {
  wire('asis-refrescar', 'click', refrescarAsistencia);
  wire('asis-bitacora-grupo', 'change', cargarGrupoSeleccionado);
  wire('asis-bitacora-mes', 'change', cargarBitacora);
  wire('asis-bitacora-profesor', 'change', cargarBitacora);
  wire('asis-guardar-mes', 'click', guardarCambiosMes);
  wire('asis-historial-refrescar', 'click', refrescarHistorial);
  wire('asis-historial-busqueda', 'input', renderHistorialFiltrado);
  wire('asis-historial-estado', 'change', renderHistorialFiltrado);

  const matrixBody = document.getElementById('asis-matrix-body');
  if (matrixBody && !matrixBody.dataset.wired) {
    matrixBody.dataset.wired = '1';
    matrixBody.addEventListener('click', manejarAccionMatriz);
  }

  const historyBody = document.getElementById('asis-historial-body');
  if (historyBody && !historyBody.dataset.wired) {
    historyBody.dataset.wired = '1';
    historyBody.addEventListener('click', manejarAccionHistorial);
  }

  const editForm = document.getElementById('asis-editar-form');
  if (editForm && !editForm.dataset.wired) {
    editForm.dataset.wired = '1';
    editForm.addEventListener('submit', guardarEdicionHistorial);
  }

  const observationForm = document.getElementById('asis-observacion-form');
  if (observationForm && !observationForm.dataset.wired) {
    observationForm.dataset.wired = '1';
    observationForm.addEventListener('submit', guardarObservacionMatriz);
  }

  const collapse = document.getElementById('asis-historial-detallado');
  if (collapse && !collapse.dataset.wired) {
    collapse.dataset.wired = '1';
    collapse.addEventListener('show.bs.collapse', cargarHistorial);
  }
}


async function ejecutarConBotonOcupado(button, tarea, texto = 'Actualizando…') {
  if (!button || button.dataset.busy === '1') return;
  const html = button.innerHTML;
  button.dataset.busy = '1';
  button.disabled = true;
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${texto}`;
  try { await tarea(); }
  finally {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = html;
      delete button.dataset.busy;
    }
  }
}

async function refrescarAsistencia(event) {
  const button = event?.currentTarget || document.getElementById('asis-refrescar');
  await ejecutarConBotonOcupado(button, loadAsistenciaData);
}

async function refrescarHistorial(event) {
  const button = event?.currentTarget || document.getElementById('asis-historial-refrescar');
  await ejecutarConBotonOcupado(button, cargarHistorial);
}

function wire(id, event, handler) {
  const el = document.getElementById(id);
  if (!el || el.dataset.wired) return;
  el.dataset.wired = '1';
  el.addEventListener(event, handler);
}

async function loadAsistenciaData() {
  const month = document.getElementById('asis-bitacora-mes');
  if (month && !month.value) month.value = mesActualISO();

  await poblarGrupos();
  aplicarPermisosUI();

  const groupSelect = document.getElementById('asis-bitacora-grupo');
  if (groupSelect?.value) {
    await cargarGrupoSeleccionado();
  } else {
    renderMatrizVacia('Selecciona un grupo para comenzar.');
  }
}

function aplicarPermisosUI() {
  const save = document.getElementById('asis-guardar-mes');
  const hint = document.getElementById('asis-bitacora-hint');

  if (!puedeEditar()) {
    if (save) {
      save.hidden = true;
      save.disabled = true;
    }
    if (hint) {
      hint.textContent = 'Tu rol tiene acceso de consulta. La edición de asistencia está reservada para docentes y administradores.';
    }
  }
}

async function poblarGrupos() {
  const select = document.getElementById('asis-bitacora-grupo');
  if (!select) return;

  const anterior = select.value;
  select.innerHTML = '<option value="">Seleccionar grupo</option>';

  try {
    const res = await apiFetch('/api/procesos/grupos');
    if (!res.ok) throw new Error('No se pudieron cargar los grupos.');
    const grupos = await res.json();

    (Array.isArray(grupos) ? grupos : []).forEach((g) => {
      const id = g.id_grupo ?? g.id;
      const nombre = etiquetaGrupo(g);
      select.add(new Option(nombre, id));
    });

    if (anterior && Array.from(select.options).some((o) => String(o.value) === String(anterior))) {
      select.value = anterior;
    }
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar los grupos.', 'error');
  }
}

function etiquetaGrupo(g) {
  const nombre = g?.nombre_grupo || `Grupo ${g?.id_grupo ?? ''}`;
  const seccion = g?.nombre_seccion || g?.nivel || '';
  return seccion ? `${nombre} · Sección ${seccion}` : nombre;
}

async function cargarGrupoSeleccionado() {
  const select = document.getElementById('asis-bitacora-grupo');
  const idGrupo = Number(select?.value || 0);
  grupoActual = idGrupo || null;
  cambiosPendientes.clear();
  actualizarCambiosPendientes();

  if (!grupoActual) {
    detalleGrupo = null;
    renderMatrizVacia('Selecciona un grupo para comenzar.');
    return;
  }

  const hint = document.getElementById('asis-bitacora-hint');
  if (hint) hint.textContent = 'Cargando estudiantes y profesor asignado...';

  try {
    const res = await apiFetch(`/api/procesos/grupos/${grupoActual}/detalle`);
    if (!res.ok) throw new Error('No se pudo cargar el grupo.');
    detalleGrupo = await res.json();
    poblarProfesoresGrupo(detalleGrupo.profesores || []);
    await cargarBitacora();

    if (hint) {
      hint.textContent = `${(detalleGrupo.estudiantes || []).length} estudiante(s) cargados. Solo se muestran los días configurados para este grupo dentro del período lectivo.`;
    }
  } catch (error) {
    detalleGrupo = null;
    renderMatrizVacia(error.message);
    showToast(error.message, 'error');
  }
}

function poblarProfesoresGrupo(profesores) {
  const select = document.getElementById('asis-bitacora-profesor');
  const field = document.getElementById('asis-profesor-field');
  if (!select) return;

  select.innerHTML = '';

  if (rolActual() === 'profesor') {
    const id = Number(currentUser?.id_profesor || 0);
    select.add(new Option(`${currentUser?.nombre || ''} ${currentUser?.apellido1 || ''}`.trim() || 'Profesor actual', id));
    select.value = String(id);
    select.disabled = true;
    if (field) field.hidden = true;
    return;
  }

  if (field) field.hidden = false;

  if (!profesores.length) {
    select.add(new Option('Sin profesor asignado', ''));
    select.disabled = true;
    return;
  }

  profesores.forEach((p) => {
    const nombre = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
    select.add(new Option(`${nombre}${p.materia ? ` · ${p.materia}` : ''}`, p.id_profesor));
  });

  select.disabled = !esAdmin();
  if (profesores.length) select.value = String(profesores[0].id_profesor);
}

function rangoMes() {
  const valor = document.getElementById('asis-bitacora-mes')?.value || mesActualISO();
  const [anio, mes] = valor.split('-').map(Number);
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { valor, anio, mes, inicio, fin, ultimo };
}

function diasLectivosMes() {
  const { anio, mes, ultimo } = rangoMes();
  const dias = [];
  const mapa = { domingo:0, lunes:1, martes:2, miercoles:3, miércoles:3, jueves:4, viernes:5, sabado:6, sábado:6 };
  const diasGrupo = new Set(String(detalleGrupo?.grupo?.dias_semana || '').split(',').map(d => mapa[d.trim().toLowerCase()]).filter(n => Number.isInteger(n)));
  const fechaInicio = detalleGrupo?.grupo?.periodo_fecha_inicio ? String(detalleGrupo.grupo.periodo_fecha_inicio).slice(0,10) : null;
  const fechaFin = detalleGrupo?.grupo?.periodo_fecha_fin ? String(detalleGrupo.grupo.periodo_fecha_fin).slice(0,10) : null;

  for (let dia = 1; dia <= ultimo; dia += 1) {
    const fecha = new Date(anio, mes - 1, dia);
    const semana = fecha.getDay();
    const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (diasGrupo.size ? !diasGrupo.has(semana) : (semana === 0 || semana === 6)) continue;
    if (fechaInicio && iso < fechaInicio) continue;
    if (fechaFin && iso > fechaFin) continue;
    dias.push({ dia, fecha: iso, semana: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][semana] });
  }
  return dias;
}

async function cargarBitacora({ conservarCambios = false } = {}) {
  if (!conservarCambios) cambiosPendientes.clear();
  actualizarCambiosPendientes();

  if (!grupoActual || !detalleGrupo) {
    renderMatrizVacia('Selecciona un grupo para comenzar.');
    return;
  }

  const profesor = Number(document.getElementById('asis-bitacora-profesor')?.value || 0);
  const { inicio, fin } = rangoMes();
  const params = new URLSearchParams({
    id_grupo: String(grupoActual),
    fecha_inicio: inicio,
    fecha_fin: fin
  });
  if (profesor) params.set('id_profesor', String(profesor));

  try {
    const res = await apiFetch(`/api/procesos/asistencia?${params.toString()}`);
    if (!res.ok) throw new Error('No se pudo cargar la asistencia del mes.');
    registrosMes = await res.json();
    renderMatriz();
  } catch (error) {
    registrosMes = [];
    renderMatrizVacia(error.message);
  }
}

function renderMatriz() {
  const head = document.getElementById('asis-matrix-head');
  const body = document.getElementById('asis-matrix-body');
  const summary = document.getElementById('asis-matrix-summary');
  if (!head || !body) return;

  const dias = diasLectivosMes();
  const estudiantes = detalleGrupo?.estudiantes || [];

  head.innerHTML = `<tr>
    <th class="student-sticky">Estudiante</th>
    ${dias.map((d) => `<th class="day-head"><span>${d.semana}</span><strong>${d.dia}</strong></th>`).join('')}
  </tr>`;

  if (!estudiantes.length) {
    body.innerHTML = `<tr><td colspan="${dias.length + 1}" class="text-center py-5 text-muted">Este grupo no tiene estudiantes matriculados.</td></tr>`;
    return;
  }

  const porClave = new Map();
  (Array.isArray(registrosMes) ? registrosMes : []).forEach((r) => {
    const fecha = String(r.fecha || '').split('T')[0];
    porClave.set(`${r.id_estudiante}-${fecha}`, r);
  });

  body.innerHTML = estudiantes.map((e) => {
    const nombre = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
    const cells = dias.map((d) => {
      const key = `${e.id_estudiante}-${d.fecha}`;
      const registro = porClave.get(key);
      const pendiente = cambiosPendientes.get(key);
      const estado = pendiente?.estado ?? registro?.estado_asistencia ?? '';
      const observaciones = pendiente?.observaciones ?? registro?.observaciones ?? '';
      const esFechaFutura = d.fecha > hoyLocalISO();
      const editable = puedeEditar() && !esFechaFutura;
      const tituloEstado = esFechaFutura
        ? 'Fecha futura: todavía no se puede registrar asistencia'
        : (estado ? nombreEstado(estado) : 'Sin registrar');
      return `<td class="attendance-cell ${esFechaFutura ? 'is-future' : ''}">
        <div class="attendance-cell-stack">
          <button
            type="button"
            class="attendance-cell-btn ${estado ? `is-${estado}` : 'is-empty'}"
            data-key="${key}"
            data-id-estudiante="${e.id_estudiante}"
            data-fecha="${d.fecha}"
            data-id-asistencia="${registro?.id_asistencia || ''}"
            data-estado="${estado}"
            title="${tituloEstado}"
            ${editable ? '' : 'disabled'}
          >${ETIQUETAS[estado] || '·'}</button>
          ${editable ? `<button type="button" class="attendance-note-btn ${observaciones ? 'has-note' : ''}" data-key="${key}" data-id-estudiante="${e.id_estudiante}" data-fecha="${d.fecha}" data-id-asistencia="${registro?.id_asistencia || ''}" title="${observaciones ? 'Editar observación' : 'Agregar observación'}"><i class="bi ${observaciones ? 'bi-chat-left-text-fill' : 'bi-chat-left-text'}"></i></button>` : ''}
        </div>
      </td>`;
    }).join('');

    return `<tr>
      <th class="student-sticky student-name-cell">
        <span class="student-name">${escapeHtml(nombre)}</span>
        <small>#${e.id_estudiante}</small>
      </th>
      ${cells}
    </tr>`;
  }).join('');

  const groupText = document.getElementById('asis-bitacora-grupo')?.selectedOptions?.[0]?.textContent || '';
  const { valor } = rangoMes();
  if (summary) summary.textContent = `${groupText} · ${valor} · ${estudiantes.length} estudiantes`;
}

function manejarAccionMatriz(event) {
  const note = event.target.closest('.attendance-note-btn');
  if (note) {
    abrirObservacionMatriz(note);
    return;
  }

  manejarCelda(event);
}

function abrirObservacionMatriz(button) {
  if (!puedeEditar()) return;

  const key = button.dataset.key;
  const idEstudiante = Number(button.dataset.idEstudiante || 0);
  const fecha = button.dataset.fecha || '';
  const idAsistencia = Number(button.dataset.idAsistencia || 0) || null;
  const registro = registrosMes.find((r) => String(r.id_estudiante) === String(idEstudiante) && String(r.fecha || '').split('T')[0] === fecha);
  const pendiente = cambiosPendientes.get(key);
  const estudiante = (detalleGrupo?.estudiantes || []).find((e) => Number(e.id_estudiante) === idEstudiante);
  const nombre = `${estudiante?.nombre ?? ''} ${estudiante?.apellido1 ?? ''} ${estudiante?.apellido2 ?? ''}`.trim();

  const stateButton = document.querySelector(`.attendance-cell-btn[data-key="${CSS.escape(key)}"]`);
  const estado = pendiente?.estado ?? stateButton?.dataset.estado ?? registro?.estado_asistencia ?? '';
  const observaciones = pendiente?.observaciones ?? registro?.observaciones ?? '';

  document.getElementById('asis-observacion-key').value = key;
  document.getElementById('asis-observacion-id-estudiante').value = idEstudiante;
  document.getElementById('asis-observacion-fecha').value = fecha;
  document.getElementById('asis-observacion-id-asistencia').value = idAsistencia || '';
  document.getElementById('asis-observacion-estudiante').value = nombre || `Estudiante #${idEstudiante}`;
  document.getElementById('asis-observacion-fecha-texto').value = formatearFecha(fecha);
  document.getElementById('asis-observacion-estado').value = estado || '';
  document.getElementById('asis-observacion-texto').value = observaciones || '';

  const modalEl = document.getElementById('modalObservacionAsistencia');
  if (modalEl && window.bootstrap?.Modal) {
    (window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).show();
  }
}

function guardarObservacionMatriz(event) {
  event.preventDefault();

  const key = document.getElementById('asis-observacion-key')?.value || '';
  const idEstudiante = Number(document.getElementById('asis-observacion-id-estudiante')?.value || 0);
  const fecha = document.getElementById('asis-observacion-fecha')?.value || '';
  const idAsistencia = Number(document.getElementById('asis-observacion-id-asistencia')?.value || 0) || null;
  const estado = document.getElementById('asis-observacion-estado')?.value || '';
  const observaciones = document.getElementById('asis-observacion-texto')?.value.trim().slice(0, 250) || null;

  if (!key || !idEstudiante || !fecha) return;
  if (!estado) {
    showToast('Selecciona un estado de asistencia antes de agregar la observación.', 'error');
    return;
  }

  cambiosPendientes.set(key, {
    id_asistencia: idAsistencia,
    id_estudiante: idEstudiante,
    fecha,
    estado,
    observaciones
  });

  const stateButton = document.querySelector(`.attendance-cell-btn[data-key="${CSS.escape(key)}"]`);
  if (stateButton) {
    stateButton.dataset.estado = estado;
    stateButton.textContent = ETIQUETAS[estado] || '·';
    stateButton.className = `attendance-cell-btn is-${estado} is-dirty`;
    stateButton.title = nombreEstado(estado);
  }

  const noteButton = document.querySelector(`.attendance-note-btn[data-key="${CSS.escape(key)}"]`);
  if (noteButton) {
    noteButton.classList.toggle('has-note', Boolean(observaciones));
    noteButton.innerHTML = `<i class="bi ${observaciones ? 'bi-chat-left-text-fill' : 'bi-chat-left-text'}"></i>`;
    noteButton.title = observaciones ? 'Editar observación' : 'Agregar observación';
  }

  actualizarCambiosPendientes();
  window.bootstrap?.Modal.getInstance(document.getElementById('modalObservacionAsistencia'))?.hide();
}

function manejarCelda(event) {
  const button = event.target.closest('.attendance-cell-btn');
  if (!button || !puedeEditar()) return;

  const actual = button.dataset.estado || '';
  const idx = ESTADOS.indexOf(actual);
  const siguiente = ESTADOS[(idx + 1) % ESTADOS.length];

  button.dataset.estado = siguiente;
  button.textContent = ETIQUETAS[siguiente] || '·';
  button.className = `attendance-cell-btn ${siguiente ? `is-${siguiente}` : 'is-empty'} is-dirty`;
  button.title = siguiente ? nombreEstado(siguiente) : 'Sin registrar';

  const key = button.dataset.key;
  const existente = cambiosPendientes.get(key);
  const registro = registrosMes.find((r) => Number(r.id_asistencia) === Number(button.dataset.idAsistencia || 0));

  cambiosPendientes.set(key, {
    id_asistencia: Number(button.dataset.idAsistencia || 0) || null,
    id_estudiante: Number(button.dataset.idEstudiante),
    fecha: button.dataset.fecha,
    estado: siguiente,
    observaciones: existente?.observaciones ?? registro?.observaciones ?? null
  });

  actualizarCambiosPendientes();
}

function actualizarCambiosPendientes() {
  const badge = document.getElementById('asis-cambios-pendientes');
  const save = document.getElementById('asis-guardar-mes');
  const total = cambiosPendientes.size;

  if (badge) {
    badge.textContent = total ? `${total} cambio(s) pendiente(s)` : 'Sin cambios';
    badge.className = total
      ? 'badge rounded-pill text-bg-warning'
      : 'badge rounded-pill text-bg-light border';
  }

  if (save && puedeEditar()) save.disabled = total === 0;
}

async function guardarCambiosMes() {
  if (!cambiosPendientes.size || !grupoActual) return;

  const idProfesor = Number(document.getElementById('asis-bitacora-profesor')?.value || currentUser?.id_profesor || 0);
  if (!idProfesor) {
    showToast('Selecciona el profesor responsable antes de guardar.', 'error');
    return;
  }

  const button = document.getElementById('asis-guardar-mes');
  if (button?.dataset.busy === '1') return;
  const old = button?.innerHTML;
  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Guardando...';
  }

  let guardados = 0;
  const fallos = [];
  const pendientes = Array.from(cambiosPendientes.entries());

  try {
    for (const [key, cambio] of pendientes) {
      try {
        if (cambio.fecha > hoyLocalISO()) {
          throw new Error('No se puede registrar asistencia en una fecha futura.');
        }

        let res = null;
        if (!cambio.estado && cambio.id_asistencia) {
          if (!esAdmin()) {
            throw new Error('Solo un administrador puede eliminar un registro de asistencia.');
          }
          res = await apiFetch(`/api/procesos/asistencia/${cambio.id_asistencia}`, { method: 'DELETE' });
        } else if (cambio.id_asistencia) {
          const registro = registrosMes.find((r) => Number(r.id_asistencia) === Number(cambio.id_asistencia));
          res = await apiFetch(`/api/procesos/asistencia/${cambio.id_asistencia}`, {
            method: 'PUT',
            body: JSON.stringify({
              estado_asistencia: cambio.estado,
              observaciones: cambio.observaciones ?? registro?.observaciones ?? null
            })
          });
        } else if (cambio.estado) {
          res = await apiFetch('/api/procesos/asistencia', {
            method: 'POST',
            body: JSON.stringify({
              fecha: cambio.fecha,
              estado_asistencia: cambio.estado,
              observaciones: cambio.observaciones ?? null,
              id_estudiante: cambio.id_estudiante,
              id_grupo: grupoActual,
              id_profesor: idProfesor
            })
          });
        }

        if (res && !res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.mensaje || data.error || `No se pudo guardar el registro (${res.status}).`);
        }

        cambiosPendientes.delete(key);
        guardados += 1;
      } catch (error) {
        console.error('Error guardando celda de asistencia', cambio, error);
        fallos.push({ key, cambio, mensaje: error?.message || 'Error desconocido al guardar.' });
      }
    }

    await cargarBitacora({ conservarCambios: fallos.length > 0 });
    if (fallos.length) {
      // Reponer únicamente los cambios que no se guardaron para que el usuario pueda corregir/reintentar.
      fallos.forEach(({ key, cambio }) => cambiosPendientes.set(key, cambio));
      renderMatriz();
      actualizarCambiosPendientes();

      const detalle = [...new Set(fallos.map((f) => f.mensaje))].slice(0, 3).join(' ');
      showResultModal(
        'error',
        guardados ? 'Guardado parcial' : 'No se pudieron guardar los cambios',
        `${guardados} cambio(s) guardado(s) y ${fallos.length} con error.${detalle ? ` ${detalle}` : ''}`
      );
    } else {
      await cargarHistorial();
      showToast(`${guardados} cambio(s) de asistencia guardado(s) correctamente.`, 'success');
    }
  } finally {
    if (button?.isConnected) {
      button.innerHTML = old || '<i class="bi bi-cloud-check me-1"></i>Guardar';
      delete button.dataset.busy;
    }
    actualizarCambiosPendientes();
  }
}

async function cargarHistorial() {
  const body = document.getElementById('asis-historial-body');
  if (!body) return;

  body.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</td></tr>';

  try {
    const res = await apiFetch('/api/procesos/asistencia');
    if (!res.ok) throw new Error('No se pudo cargar el historial.');
    historialCompleto = await res.json();
    renderHistorialFiltrado();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderHistorialFiltrado() {
  const body = document.getElementById('asis-historial-body');
  if (!body) return;

  const search = String(document.getElementById('asis-historial-busqueda')?.value || '').toLowerCase().trim();
  const estado = document.getElementById('asis-historial-estado')?.value || '';

  const rows = (Array.isArray(historialCompleto) ? historialCompleto : []).filter((r) => {
    const texto = [
      r.estudiante_nombre, r.estudiante_apellido1, r.estudiante_apellido2,
      r.profesor_nombre, r.profesor_apellido1, r.nombre_grupo, r.nombre_seccion,
      r.materia_curso, r.observaciones
    ].filter(Boolean).join(' ').toLowerCase();

    if (estado && String(r.estado_asistencia).toLowerCase() !== estado) return false;
    if (search && !texto.includes(search)) return false;
    return true;
  });

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No hay registros con esos filtros.</td></tr>';
    return;
  }

  body.innerHTML = rows.slice(0, 500).map((r) => {
    const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
    const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
    const grupo = r.nombre_seccion ? `${r.nombre_grupo ?? '-'} · ${r.nombre_seccion}` : (r.nombre_grupo ?? '-');

    return `<tr>
      <td>${formatearFecha(r.fecha)}</td>
      <td>${escapeHtml(estudiante)}</td>
      <td>${escapeHtml(grupo)}</td>
      <td>${escapeHtml(profesor)}</td>
      <td>${escapeHtml(r.materia_curso || '-')}</td>
      <td><span class="attendance-badge attendance-${String(r.estado_asistencia || '').toLowerCase()}">${nombreEstado(r.estado_asistencia)}</span></td>
      <td class="observaciones-cell" title="${escapeHtml(r.observaciones || '')}">${escapeHtml(r.observaciones || '—')}</td>
      <td class="text-end">
        ${puedeEditar() ? `<button class="btn btn-sm btn-outline-primary asis-edit-btn" data-id="${r.id_asistencia}"><i class="bi bi-pencil"></i></button>` : ''}
        ${esAdmin() ? `<button class="btn btn-sm btn-outline-danger asis-delete-btn ms-1" data-id="${r.id_asistencia}"><i class="bi bi-trash"></i></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function manejarAccionHistorial(event) {
  const edit = event.target.closest('.asis-edit-btn');
  const del = event.target.closest('.asis-delete-btn');

  if (edit) {
    const registro = historialCompleto.find((r) => Number(r.id_asistencia) === Number(edit.dataset.id));
    if (!registro) return;

    document.getElementById('asis-editar-id').value = registro.id_asistencia;
    document.getElementById('asis-editar-estudiante').value =
      `${registro.estudiante_nombre ?? ''} ${registro.estudiante_apellido1 ?? ''} ${registro.estudiante_apellido2 ?? ''}`.trim();
    document.getElementById('asis-editar-estado').value = String(registro.estado_asistencia || '').toLowerCase();
    document.getElementById('asis-editar-observaciones').value = registro.observaciones || '';

    const modalEl = document.getElementById('modalEditarAsistencia');
    if (modalEl && window.bootstrap?.Modal) {
      (window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).show();
    }
  }

  if (del && esAdmin()) {
    eliminarAsistencia(Number(del.dataset.id));
  }
}

async function guardarEdicionHistorial(event) {
  event.preventDefault();

  const id = Number(document.getElementById('asis-editar-id')?.value || 0);
  const estado = document.getElementById('asis-editar-estado')?.value || '';
  const observaciones = document.getElementById('asis-editar-observaciones')?.value.trim() || null;
  if (!id || !estado) return;

  try {
    const res = await apiFetch(`/api/procesos/asistencia/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado_asistencia: estado, observaciones })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.mensaje || 'No se pudo actualizar.');

    window.bootstrap?.Modal.getInstance(document.getElementById('modalEditarAsistencia'))?.hide();
    showToast('Asistencia actualizada.', 'success');
    await cargarHistorial();
    await cargarBitacora();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function eliminarAsistencia(id) {
  if (!window.confirm('¿Eliminar permanentemente este registro de asistencia? Esta acción quedará registrada en auditoría.')) return;

  const button = document.querySelector(`.asis-delete-btn[data-id="${id}"]`);
  const row = button?.closest('tr');
  if (button) button.disabled = true;
  if (row) row.classList.add('is-removing');

  try {
    const res = await apiFetch(`/api/procesos/asistencia/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.mensaje || 'No se pudo eliminar.');

    // Actualización inmediata: no dejamos un registro eliminado visible mientras
    // se completan las dos consultas de sincronización.
    historialCompleto = historialCompleto.filter((r) => Number(r.id_asistencia) !== Number(id));
    renderHistorialFiltrado();
    showToast('Registro de asistencia eliminado.', 'success');

    await Promise.allSettled([cargarHistorial(), cargarBitacora()]);
  } catch (error) {
    if (row) row.classList.remove('is-removing');
    if (button?.isConnected) button.disabled = false;
    showToast(error.message, 'error');
  }
}

function renderMatrizVacia(mensaje) {
  const head = document.getElementById('asis-matrix-head');
  const body = document.getElementById('asis-matrix-body');
  const summary = document.getElementById('asis-matrix-summary');

  if (head) head.innerHTML = '<tr><th class="student-sticky">Estudiante</th></tr>';
  if (body) body.innerHTML = `<tr><td class="text-center py-5 text-muted">${escapeHtml(mensaje)}</td></tr>`;
  if (summary) summary.textContent = mensaje;
}

function nombreEstado(estado) {
  const map = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };
  return map[String(estado || '').toLowerCase()] || 'Sin registrar';
}

function formatearFecha(value) {
  if (!value) return '—';
  const base = String(value).split('T')[0];
  const [y, m, d] = base.split('-');
  return y && m && d ? `${d}/${m}/${y}` : base;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
