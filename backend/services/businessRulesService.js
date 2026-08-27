import pool from '../config/database.js';

const DIAS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

function hoyAplicacionISO() {
  const zona = String(process.env.APP_TIMEZONE || 'America/Costa_Rica').trim() || 'America/Costa_Rica';
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function fechaIso(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const text = String(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function diaSemanaFecha(valor) {
  const iso = fechaIso(valor);
  if (!iso) return null;
  const [y,m,d] = iso.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function normalizarDias(valor) {
  if (Array.isArray(valor)) valor = valor.join(',');
  return [...new Set(String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().split(',').map((x) => x.trim()).filter(Boolean))];
}

export async function obtenerPeriodoLectivo(connection, anio, lock = false) {
  const year = Number(anio);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('El año lectivo no es válido.');
  const [rows] = await connection.query(
    `SELECT anio, fecha_inicio, fecha_fin, estado, fecha_cierre
     FROM periodo_lectivo WHERE anio = ? ${lock ? 'FOR UPDATE' : ''}`,
    [year]
  );
  if (!rows.length) throw new Error(`El período lectivo ${year} no está configurado.`);
  return rows[0];
}

export async function validarPeriodoMatricula(connection, anio) {
  const periodo = await obtenerPeriodoLectivo(connection, anio, true);
  if (String(periodo.estado).toUpperCase() !== 'ACTIVO') {
    throw new Error(`No se puede matricular ni transferir estudiantes: el período lectivo ${anio} está ${String(periodo.estado).toLowerCase()}.`);
  }
  return periodo;
}

export async function validarPeriodoNoCerrado(connection, anio) {
  const periodo = await obtenerPeriodoLectivo(connection, anio, true);
  if (String(periodo.estado).toUpperCase() === 'CERRADO') {
    throw new Error(`El período lectivo ${anio} está cerrado. No se permiten cambios académicos.`);
  }
  return periodo;
}

export async function validarFechaAsistencia(connection, idGrupo, fecha) {
  const iso = fechaIso(fecha);
  if (!iso) throw new Error('La fecha de asistencia no es válida.');
  const [[grupo]] = await connection.query(
    `SELECT g.id_grupo, g.nombre_grupo, g.dias_semana, s.periodo_lectivo,
            pl.fecha_inicio, pl.fecha_fin, pl.estado AS estado_periodo
     FROM grupo g
     INNER JOIN seccion s ON s.id_seccion = g.id_seccion
     INNER JOIN periodo_lectivo pl ON pl.anio = s.periodo_lectivo
     WHERE g.id_grupo = ? LIMIT 1`,
    [idGrupo]
  );
  if (!grupo) throw new Error('El grupo no existe.');
  if (String(grupo.estado_periodo).toUpperCase() === 'CERRADO') {
    throw new Error(`No se puede registrar ni modificar asistencia: el período ${grupo.periodo_lectivo} está cerrado.`);
  }
  const hoy = hoyAplicacionISO();
  if (iso > hoy) throw new Error('No se puede registrar asistencia en una fecha futura.');
  const inicio = fechaIso(grupo.fecha_inicio);
  const fin = fechaIso(grupo.fecha_fin);
  if ((inicio && iso < inicio) || (fin && iso > fin)) {
    throw new Error(`La fecha está fuera del período lectivo (${inicio} a ${fin}).`);
  }
  const dia = diaSemanaFecha(iso);
  const permitidos = normalizarDias(grupo.dias_semana);
  if (!permitidos.includes(dia)) {
    throw new Error(`El grupo ${grupo.nombre_grupo} no imparte clases los ${dia}.`);
  }
  return grupo;
}

function horaMinutos(hora) {
  if (!hora) return 0;
  const [h,m] = String(hora).slice(0,5).split(':').map(Number);
  return (h * 60) + m;
}

export function horasSemanalesGrupo(dias, horaInicio, horaFin) {
  const cantidadDias = normalizarDias(dias).length;
  const minutos = Math.max(0, horaMinutos(horaFin) - horaMinutos(horaInicio));
  return (minutos / 60) * cantidadDias;
}

export async function validarCargaDocente(connection, idProfesor, dias, horaInicio, horaFin, excluirGrupoId = null, periodoLectivo = null) {
  const [[profesor]] = await connection.query(
    `SELECT id_profesor, horas_maximas_semana FROM profesor WHERE id_profesor = ? LIMIT 1`,
    [idProfesor]
  );
  if (!profesor) throw new Error('El profesor no existe.');

  let periodo = periodoLectivo ? Number(periodoLectivo) : null;
  if (!periodo && excluirGrupoId) {
    const [[p]] = await connection.query(`SELECT s.periodo_lectivo FROM grupo g INNER JOIN seccion s ON s.id_seccion = g.id_seccion WHERE g.id_grupo = ? LIMIT 1`, [excluirGrupoId]);
    periodo = Number(p?.periodo_lectivo || 0) || null;
  }

  const params = [idProfesor];
  let filtroPeriodo = '';
  if (periodo) { filtroPeriodo = 'AND s.periodo_lectivo = ?'; params.push(periodo); }
  let exclude = '';
  if (excluirGrupoId) { exclude = 'AND g.id_grupo <> ?'; params.push(Number(excluirGrupoId)); }
  const [rows] = await connection.query(
    `SELECT g.id_grupo, g.dias_semana, g.hora_inicio, g.hora_fin
     FROM grupo_profesor gp
     INNER JOIN grupo g ON g.id_grupo = gp.id_grupo AND g.estado = TRUE
     INNER JOIN seccion s ON s.id_seccion = g.id_seccion
     INNER JOIN periodo_lectivo pl ON pl.anio = s.periodo_lectivo AND pl.estado <> 'CERRADO'
     WHERE gp.id_profesor = ? AND gp.estado = TRUE
       AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= CURDATE()) ${filtroPeriodo} ${exclude}`,
    params
  );
  const actuales = rows.reduce((sum, g) => sum + horasSemanalesGrupo(g.dias_semana, g.hora_inicio, g.hora_fin), 0);
  const nuevas = horasSemanalesGrupo(dias, horaInicio, horaFin);
  const maximo = Number(profesor.horas_maximas_semana || 40);
  if (actuales + nuevas > maximo + 0.001) {
    throw new Error(`La asignación excede la carga máxima del profesor (${maximo} h/semana). Carga resultante: ${(actuales+nuevas).toFixed(1)} h/semana.`);
  }
  return { actuales, nuevas, maximo };
}

export async function validarAulaCatalogo(connection, aula, capacidadGrupo = null) {
  const codigo = String(aula || '').trim();
  if (!codigo) throw new Error('Debes seleccionar un aula.');
  const [[row]] = await connection.query(`SELECT codigo, capacidad_referencial FROM aula WHERE codigo = ? AND estado = TRUE LIMIT 1`, [codigo]);
  if (!row) throw new Error('El aula seleccionada no pertenece al catálogo disponible.');
  const capacidadAula = Number(row.capacidad_referencial || 0);
  if (capacidadGrupo && capacidadAula > 0 && Number(capacidadGrupo) > capacidadAula) {
    throw new Error(`La capacidad del grupo (${capacidadGrupo}) supera la capacidad del ${codigo} (${capacidadAula}).`);
  }
  return codigo;
}

export async function actualizarEstadoAcademico(connection, idEstudiante, estadoAcademico) {
  const validos = new Set(['preinscrito','matriculado','retirado','trasladado']);
  if (!validos.has(estadoAcademico)) throw new Error('Estado académico no válido.');
  await connection.query(`UPDATE estudiante SET estado_academico = ? WHERE id_estudiante = ?`, [estadoAcademico, idEstudiante]);
}
