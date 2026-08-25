import pool from "../config/database.js";

let grupoHorarioSchemaPromise = null;

async function asegurarCamposHorarioGrupo() {
  if (grupoHorarioSchemaPromise) return grupoHorarioSchemaPromise;
  grupoHorarioSchemaPromise = (async () => {
    const [inicio] = await pool.query("SHOW COLUMNS FROM grupo LIKE 'hora_inicio'");
    if (!inicio.length) await pool.query("ALTER TABLE grupo ADD COLUMN hora_inicio TIME NULL");
    const [fin] = await pool.query("SHOW COLUMNS FROM grupo LIKE 'hora_fin'");
    if (!fin.length) await pool.query("ALTER TABLE grupo ADD COLUMN hora_fin TIME NULL");
    const [dias] = await pool.query("SHOW COLUMNS FROM grupo LIKE 'dias_semana'");
    if (!dias.length) await pool.query("ALTER TABLE grupo ADD COLUMN dias_semana VARCHAR(80) NOT NULL DEFAULT ''");
  })().catch((error) => {
    grupoHorarioSchemaPromise = null;
    throw new Error(`No se pudo preparar el horario de grupos: ${error.message}`);
  });
  return grupoHorarioSchemaPromise;
}



const DIAS_SEMANA_VALIDOS = ['lunes','martes','miercoles','jueves','viernes','sabado'];

function sinTildes(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarDiasSemana(valor, nombreGrupo = '') {
  let dias = [];
  if (Array.isArray(valor)) dias = valor;
  else if (typeof valor === 'string' && valor.trim()) dias = valor.split(',');
  dias = [...new Set(dias.map((d) => sinTildes(d).trim()).filter((d) => DIAS_SEMANA_VALIDOS.includes(d)))];
  if (dias.length) return dias;
  const texto = sinTildes(nombreGrupo);
  return DIAS_SEMANA_VALIDOS.filter((dia) => texto.includes(dia));
}

function diasComoTexto(dias) {
  return normalizarDiasSemana(dias).join(',');
}

function horariosSeSuperponen(inicioA, finA, inicioB, finB) {
  if (!inicioA || !finA || !inicioB || !finB) return false;
  return String(inicioA) < String(finB) && String(finA) > String(inicioB);
}

function diasSeSuperponen(diasA, diasB) {
  const a = new Set(normalizarDiasSemana(diasA));
  return normalizarDiasSemana(diasB).some((dia) => a.has(dia));
}

export async function validarProfesorActivo(connection, idProfesor) {
  const [[profesor]] = await connection.query(
    `SELECT pr.id_profesor, pr.estado, p.estado AS persona_estado
     FROM profesor pr
     INNER JOIN persona p ON p.id_persona = pr.id_persona
     WHERE pr.id_profesor = ? LIMIT 1`,
    [idProfesor]
  );
  if (!profesor || !profesor.estado || !profesor.persona_estado) {
    throw new Error('No se puede asignar un profesor inexistente o inactivo.');
  }
}

export async function validarChoqueProfesor(connection, idProfesor, dias, horaInicio, horaFin, excluirGrupoId = null) {
  if (!dias.length || !horaInicio || !horaFin) return;
  const [asignaciones] = await connection.query(
    `SELECT g.id_grupo, g.nombre_grupo, g.dias_semana, g.hora_inicio, g.hora_fin, s.nombre_seccion
     FROM grupo_profesor gp
     INNER JOIN grupo g ON g.id_grupo = gp.id_grupo AND g.estado = TRUE
     LEFT JOIN seccion s ON s.id_seccion = g.id_seccion
     WHERE gp.id_profesor = ? AND gp.estado = TRUE
       AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= CURDATE())
       ${excluirGrupoId ? 'AND g.id_grupo <> ?' : ''}`,
    excluirGrupoId ? [idProfesor, excluirGrupoId] : [idProfesor]
  );
  const choque = asignaciones.find((g) =>
    diasSeSuperponen(dias, g.dias_semana || g.nombre_grupo) &&
    horariosSeSuperponen(horaInicio, horaFin, g.hora_inicio, g.hora_fin)
  );
  if (choque) {
    throw new Error(`El profesor ya tiene el grupo ${choque.nombre_grupo}${choque.nombre_seccion ? ` (sección ${choque.nombre_seccion})` : ''} en un horario que se superpone.`);
  }
}

async function validarChoqueAula(connection, aula, dias, horaInicio, horaFin, excluirGrupoId = null) {
  if (!aula || !dias.length || !horaInicio || !horaFin) return;
  const [grupos] = await connection.query(
    `SELECT id_grupo, nombre_grupo, aula, dias_semana, hora_inicio, hora_fin
     FROM grupo
     WHERE estado = TRUE AND LOWER(TRIM(aula)) = LOWER(TRIM(?))
       ${excluirGrupoId ? 'AND id_grupo <> ?' : ''}`,
    excluirGrupoId ? [aula, excluirGrupoId] : [aula]
  );
  const choque = grupos.find((g) =>
    diasSeSuperponen(dias, g.dias_semana || g.nombre_grupo) &&
    horariosSeSuperponen(horaInicio, horaFin, g.hora_inicio, g.hora_fin)
  );
  if (choque) throw new Error(`El aula ${aula} ya está ocupada por ${choque.nombre_grupo} en ese horario.`);
}

function normalizarHoraGrupo(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d(?:\:[0-5]\d)?$/.test(raw)) throw new Error('El horario del grupo no tiene un formato válido.');
  return raw.length === 5 ? `${raw}:00` : raw;
}

/* ==========================================
   MATRÍCULA
   ========================================== */
export async function procesarMatricula(datos) {
  const {
    fecha,
    periodo,
    anio,
    tipo,
    estado,
    observaciones,
    id_estudiante,
    id_usuario,
    id_grupo
  } = datos;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [estudianteRows] = await connection.query(
      "SELECT estado FROM estudiante WHERE id_estudiante = ?",
      [id_estudiante]
    );
    if (estudianteRows.length === 0) {
      throw new Error("El estudiante no existe.");
    }
    if (!estudianteRows[0].estado) {
      throw new Error("No se puede matricular a un estudiante inactivo.");
    }

    if (!datos.omitir_validacion_financiera) {
    const [finRows] = await connection.query(
      `SELECT c.id_cargo, c.estado, c.total, c.saldo,
              COALESCE((SELECT SUM(pg.monto) FROM pago pg WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'), 0) AS pagado
       FROM cargo_estudiante c
       INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
       WHERE c.id_estudiante = ? AND cc.codigo = 'MATRICULA' AND c.estado <> 'anulado'
         AND (c.periodo = ? OR c.periodo IS NULL OR c.periodo = '')
       ORDER BY c.id_cargo DESC LIMIT 1 FOR UPDATE`,
      [id_estudiante, String(anio || new Date().getFullYear())]
    );
    const cargoMatricula = finRows[0];
    const abonadoMatricula = Number(cargoMatricula?.pagado || 0);
    if (!cargoMatricula || (cargoMatricula.estado !== 'pagado' && abonadoMatricula < 10000)) {
      throw new Error(
        !cargoMatricula
          ? 'No se puede procesar la matrícula todavía. Se requiere un abono mínimo de CRC 10.000.'
          : `No se puede procesar la matrícula todavía. Abonado: CRC ${abonadoMatricula.toLocaleString('es-CR')}. Mínimo requerido: CRC 10.000.`
      );
    }
    }

    const [usuarioRows] = await connection.query(
      "SELECT estado FROM usuario WHERE id_usuario = ?",
      [id_usuario]
    );
    if (usuarioRows.length === 0 || !usuarioRows[0].estado) {
      throw new Error("El usuario que procesa la matrícula no es válido.");
    }

    const [grupoRows] = await connection.query(
      `SELECT g.capacidad, g.estado, s.periodo_lectivo, fn_estudiantes_grupo(g.id_grupo) AS ocupados
       FROM grupo g INNER JOIN seccion s ON s.id_seccion = g.id_seccion
       WHERE g.id_grupo = ? FOR UPDATE`,
      [id_grupo]
    );
    if (grupoRows.length === 0) {
      throw new Error("El grupo no existe.");
    }
    if (!grupoRows[0].estado) {
      throw new Error("El grupo seleccionado está inactivo.");
    }
    const { capacidad, ocupados } = grupoRows[0];
    if (ocupados >= capacidad) {
      throw new Error("El grupo ya no tiene cupo disponible.");
    }

    const [yaEnGrupo] = await connection.query(
      "SELECT id_grupo_estudiante FROM grupo_estudiante WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE",
      [id_grupo, id_estudiante]
    );
    if (yaEnGrupo.length > 0) throw new Error("El estudiante ya está matriculado en este grupo.");

    const [otraAsignacion] = await connection.query(
      `SELECT ge.id_grupo, g.nombre_grupo
       FROM grupo_estudiante ge
       INNER JOIN grupo g ON g.id_grupo = ge.id_grupo AND g.estado = TRUE
       INNER JOIN seccion s ON s.id_seccion = g.id_seccion
       WHERE ge.id_estudiante = ? AND ge.estado = TRUE
         AND s.periodo_lectivo = ? AND ge.id_grupo <> ?
       LIMIT 1 FOR UPDATE`,
      [id_estudiante, grupoRows[0].periodo_lectivo, id_grupo]
    );
    if (otraAsignacion.length) {
      throw new Error(`El estudiante ya está asignado a ${otraAsignacion[0].nombre_grupo} en este año lectivo. Usa la opción Transferir matrícula.`);
    }

    const observacionesMatricula = observaciones ? observaciones.trim().slice(0, 150) : null;
    const observacionesDetalle = observaciones ? observaciones.trim().slice(0, 150) : null;

    await connection.query(
      "CALL sp_registrar_matricula(?, ?, ?, ?, ?, ?, ?, ?)",
      [fecha, periodo, anio, tipo, estado, observacionesMatricula, id_estudiante, id_usuario]
    );
    const [[{ id_matricula }]] = await connection.query(
      "SELECT LAST_INSERT_ID() AS id_matricula"
    );

    if (id_matricula) {
      await connection.query(
        "CALL sp_registrar_detalle_matricula(?, ?, ?, ?)",
        [fecha, observacionesDetalle, id_matricula, id_grupo]
      );
    }

    await connection.query(
      "CALL sp_asignar_estudiante_grupo(?, ?, ?)",
      [fecha, id_grupo, id_estudiante]
    );

    await connection.commit();
    return { mensaje: "Matrícula procesada correctamente.", id_matricula };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ==========================================
   GRUPOS
   ========================================== */
export async function obtenerGruposService(usuarioActual = null) {
  await asegurarCamposHorarioGrupo();
  const rol = (usuarioActual?.nom_rol || usuarioActual?.rol || "").toLowerCase();

  if (rol === "profesor") {
    const idProfesor = usuarioActual.id_profesor;
    if (!idProfesor) {
      return [];
    }

    const [rows] = await pool.query(
      `SELECT
          g.id_grupo,
          g.nombre_grupo,
          g.capacidad,
          g.aula,
          g.hora_inicio,
          g.hora_fin,
          g.dias_semana,
          g.id_seccion,
          s.nombre_seccion,
          s.nivel,
          s.periodo_lectivo,
          fn_estudiantes_grupo(g.id_grupo) AS ocupados
       FROM grupo g
       INNER JOIN seccion s ON g.id_seccion = s.id_seccion
       LEFT JOIN grupo_profesor gp ON gp.id_grupo = g.id_grupo
         AND gp.id_profesor = ? AND gp.estado = TRUE
       LEFT JOIN profesor_suplencia su ON su.id_grupo = g.id_grupo
         AND su.id_profesor_suplente = ? AND su.estado = TRUE
       WHERE g.estado = TRUE
         AND (gp.id_profesor = ? OR su.id_profesor_suplente = ?)
       ORDER BY s.periodo_lectivo DESC, s.nivel, g.nombre_grupo`,
      [idProfesor, idProfesor, idProfesor, idProfesor]
    );
    return rows;
  }

  const [rows] = await pool.query(
    `SELECT
        g.id_grupo,
        g.nombre_grupo,
        g.capacidad,
        g.aula,
        g.hora_inicio,
        g.hora_fin,
        g.dias_semana,
        g.id_seccion,
        s.nombre_seccion,
        s.nivel,
        s.periodo_lectivo,
        fn_estudiantes_grupo(g.id_grupo) AS ocupados
     FROM grupo g
     INNER JOIN seccion s ON g.id_seccion = s.id_seccion
     WHERE g.estado = TRUE
     ORDER BY s.periodo_lectivo DESC, s.nivel, g.nombre_grupo`
  );
  return rows;
}

export async function crearGrupoService(datos) {
  await asegurarCamposHorarioGrupo();
  const { nombre_grupo, capacidad, aula, profesores, id_profesor, id_seccion, hora_inicio, hora_fin, dias_semana } = datos;

  const nombreLimpio = (nombre_grupo || "").trim();
  const capacidadNum = Number(capacidad);
  const idSeccionNum = Number(id_seccion);
  const horaInicio = normalizarHoraGrupo(hora_inicio);
  const horaFin = normalizarHoraGrupo(hora_fin);
  const diasSemana = normalizarDiasSemana(dias_semana, nombreLimpio);

  // Normalizar array de profesores
  let listaProfesores = [];
  if (Array.isArray(profesores)) {
    listaProfesores = profesores.map(p => Number(p)).filter(p => !isNaN(p) && p > 0);
  } else if (id_profesor && !isNaN(Number(id_profesor))) {
    listaProfesores = [Number(id_profesor)];
  }

  if (!nombreLimpio) throw new Error("El nombre del grupo es obligatorio.");
  if (!Number.isInteger(capacidadNum) || capacidadNum <= 0) throw new Error("La capacidad debe ser un número entero mayor a cero.");
  if (!Number.isInteger(idSeccionNum) || idSeccionNum <= 0) throw new Error("Debe seleccionar una sección académica.");
  if (!diasSemana.length) throw new Error("Debes seleccionar al menos un día de clase.");
  if (!horaInicio || !horaFin) throw new Error("Debes indicar la hora de inicio y la hora de finalización del grupo.");
  if (horaFin <= horaInicio) throw new Error("La hora de finalización debe ser posterior a la hora de inicio.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [seccionRows] = await connection.query(
      "SELECT id_seccion FROM seccion WHERE id_seccion = ? AND estado = TRUE",
      [idSeccionNum]
    );
    if (seccionRows.length === 0) throw new Error("La sección seleccionada no existe o está inactiva.");

    const [seccionOcupada] = await connection.query(
      `SELECT g.id_grupo, g.nombre_grupo, s.nombre_seccion
       FROM grupo g
       INNER JOIN seccion s ON s.id_seccion = g.id_seccion
       WHERE g.id_seccion = ? AND g.estado = TRUE
       LIMIT 1
       FOR UPDATE`,
      [idSeccionNum]
    );
    if (seccionOcupada.length > 0) {
      const ocupada = seccionOcupada[0];
      throw new Error(
        `La sección ${ocupada.nombre_seccion || idSeccionNum} ya está reservada por el grupo ${ocupada.nombre_grupo}. Selecciona otra sección disponible.`
      );
    }

    const [dupRows] = await connection.query(
      `SELECT id_grupo
       FROM grupo
       WHERE nombre_grupo = ?
         AND id_seccion = ?
         AND estado = TRUE
       LIMIT 1`,
      [nombreLimpio, idSeccionNum]
    );
    if (dupRows.length > 0) {
      throw new Error("Ya existe un grupo activo con ese nombre en la sección seleccionada.");
    }

    const aulaLimpia = aula ? aula.trim() : null;
    await validarChoqueAula(connection, aulaLimpia, diasSemana, horaInicio, horaFin);
    for (const idProf of listaProfesores) {
      await validarProfesorActivo(connection, idProf);
      await validarChoqueProfesor(connection, idProf, diasSemana, horaInicio, horaFin);
    }

    const [result] = await connection.query(
      "INSERT INTO grupo (nombre_grupo, estado, capacidad, aula, hora_inicio, hora_fin, dias_semana, id_seccion) VALUES (?, TRUE, ?, ?, ?, ?, ?, ?)",
      [nombreLimpio, capacidadNum, aulaLimpia, horaInicio, horaFin, diasComoTexto(diasSemana), idSeccionNum]
    );
    const id_grupo = result.insertId;

    if (listaProfesores.length > 0) {
      const fechaHoy = new Date().toISOString().split("T")[0];
      for (const idProf of listaProfesores) {
        await connection.query(
          "CALL sp_asignar_profesor_grupo(?, ?, ?, ?)",
          [fechaHoy, null, id_grupo, idProf]
        );
      }
    }

    await connection.commit();
    return { mensaje: "Grupo creado correctamente.", id_grupo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function actualizarGrupoService(idGrupo, datos) {
  await asegurarCamposHorarioGrupo();
  const { capacidad, aula, id_profesor, profesores, hora_inicio, hora_fin, dias_semana } = datos;
  const horaInicio = normalizarHoraGrupo(hora_inicio);
  const horaFin = normalizarHoraGrupo(hora_fin);
  const profesoresIncluidos = Array.isArray(profesores) || id_profesor !== undefined;
  if ((horaInicio && !horaFin) || (!horaInicio && horaFin)) throw new Error('Debe indicar hora de inicio y hora de finalización.');
  if (horaInicio && horaFin && horaFin <= horaInicio) throw new Error('La hora de finalización debe ser posterior a la hora de inicio.');

  const capacidadNum = Number(capacidad);
  let listaProfesores = [];
  if (Array.isArray(profesores)) {
    listaProfesores = profesores.map(p => Number(p)).filter(p => !isNaN(p) && p > 0);
  } else if (id_profesor && !isNaN(Number(id_profesor))) {
    listaProfesores = [Number(id_profesor)];
  }

  if (!Number.isInteger(capacidadNum) || capacidadNum <= 0) {
    throw new Error("La capacidad debe ser un número entero mayor a cero.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [grupoRows] = await connection.query(
      `SELECT
          id_grupo,
          estado,
          nombre_grupo,
          aula,
          hora_inicio,
          hora_fin,
          dias_semana,
          fn_estudiantes_grupo(id_grupo) AS ocupados
       FROM grupo
       WHERE id_grupo = ? AND estado = TRUE
       FOR UPDATE`,
      [idGrupo]
    );
    if (grupoRows.length === 0) {
      throw new Error("El grupo no existe o está inactivo.");
    }

    const ocupadosActuales = Number(grupoRows[0].ocupados || 0);
    if (capacidadNum < ocupadosActuales) {
      throw new Error(
        `No puedes reducir la capacidad a ${capacidadNum}. El grupo tiene ${ocupadosActuales} estudiante${ocupadosActuales === 1 ? "" : "s"} matriculado${ocupadosActuales === 1 ? "" : "s"}. La capacidad mínima permitida es ${ocupadosActuales}.`
      );
    }

    const grupoActual = grupoRows[0];
    const diasSemana = normalizarDiasSemana(dias_semana, grupoActual.nombre_grupo);
    const aulaLimpia = aula ? aula.trim() : null;
    const profesoresAValidar = profesoresIncluidos
      ? listaProfesores
      : (await connection.query(`SELECT id_profesor FROM grupo_profesor WHERE id_grupo = ? AND estado = TRUE`, [idGrupo]))[0].map((r) => Number(r.id_profesor));

    if (!diasSemana.length) throw new Error('Debes seleccionar al menos un día de clase.');
    if (!horaInicio || !horaFin) throw new Error('Debes indicar la hora de inicio y la hora de finalización del grupo.');
    await validarChoqueAula(connection, aulaLimpia, diasSemana, horaInicio, horaFin, Number(idGrupo));
    for (const idProf of profesoresAValidar) {
      await validarProfesorActivo(connection, idProf);
      await validarChoqueProfesor(connection, idProf, diasSemana, horaInicio, horaFin, Number(idGrupo));
    }

    await connection.query(
      `UPDATE grupo
       SET capacidad = ?, aula = ?, hora_inicio = ?, hora_fin = ?, dias_semana = ?
       WHERE id_grupo = ?`,
      [capacidadNum, aulaLimpia, horaInicio, horaFin, diasComoTexto(diasSemana), idGrupo]
    );

    if (profesoresIncluidos) {
      await connection.query(
        `UPDATE grupo_profesor
         SET fecha_fin = CURDATE(), estado = FALSE
         WHERE id_grupo = ? AND estado = TRUE`,
        [idGrupo]
      );

      for (const idProf of listaProfesores) {
        await connection.query(
          `INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, estado)
           VALUES (?, ?, CURDATE(), TRUE)`,
          [idGrupo, idProf]
        );
      }
    }

    await connection.commit();
    return { mensaje: "Grupo actualizado correctamente.", id_grupo: idGrupo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function eliminarGrupoService(idGrupo) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verificar si el grupo existe y está activo
    const [grupoRows] = await connection.query(
      "SELECT id_grupo FROM grupo WHERE id_grupo = ? AND estado = TRUE",
      [idGrupo]
    );
    if (grupoRows.length === 0) {
      throw new Error("El grupo no existe o ya se encuentra inactivo.");
    }

    // 2. Opcional: Validar si tiene estudiantes activos matriculados
    const [estudiantesRows] = await connection.query(
      "SELECT COUNT(*) AS total FROM grupo_estudiante WHERE id_grupo = ? AND estado = TRUE",
      [idGrupo]
    );
    if (estudiantesRows[0].total > 0) {
      throw new Error("No se puede eliminar el grupo porque tiene estudiantes matriculados activos.");
    }

    // 3. Realizar el borrado lógico del grupo
    await connection.query(
      "UPDATE grupo SET estado = FALSE WHERE id_grupo = ?",
      [idGrupo]
    );

    // 4. Desactivar relaciones asociadas (profesores en el grupo)
    await connection.query(
      "UPDATE grupo_profesor SET estado = FALSE, fecha_fin = COALESCE(fecha_fin, CURDATE()) WHERE id_grupo = ?",
      [idGrupo]
    );

    await connection.commit();
    return { mensaje: "Grupo eliminado correctamente.", id_grupo: idGrupo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ==========================================
   ROSTER DE GRUPO (para Asistencia)
   ========================================== */
export async function obtenerDetalleGrupoService(id_grupo) {
  const [estudiantes] = await pool.query(
    `SELECT e.id_estudiante, p.nombre, p.apellido1, p.apellido2
     FROM grupo_estudiante ge
     INNER JOIN estudiante e ON ge.id_estudiante = e.id_estudiante
     INNER JOIN persona p ON e.id_persona = p.id_persona
     WHERE ge.id_grupo = ? AND ge.estado = TRUE AND e.estado = TRUE
     ORDER BY p.apellido1, p.apellido2, p.nombre`,
    [id_grupo]
  );

  const [profesores] = await pool.query(
    `SELECT pr.id_profesor, p.nombre, p.apellido1, p.apellido2, pr.materia
     FROM grupo_profesor gp
     INNER JOIN profesor pr ON gp.id_profesor = pr.id_profesor
     INNER JOIN persona p ON pr.id_persona = p.id_persona
     WHERE gp.id_grupo = ? AND gp.estado = TRUE AND pr.estado = TRUE`,
    [id_grupo]
  );

  return { estudiantes, profesores };
}

export async function listarMatriculasService(filtros = {}) {
  const {
    id_grupo,
    estado,
    periodo,
    anio, 
    fecha_inicio,
    fecha_fin,
    busqueda
  } = filtros;

  const condiciones = [];
  const valores = [];

  if (id_grupo) {
    condiciones.push("dm.id_grupo = ?");
    valores.push(id_grupo);
  }

  if (estado) {
    condiciones.push("LOWER(m.estado_matricula) = ?");
    valores.push(String(estado).trim().toLowerCase());
  }

  if (periodo) {
    condiciones.push("m.periodo_lectivo = ?");
    valores.push(periodo);
  }

  if (anio) {
    condiciones.push("m.anio_lectivo = ?");
    valores.push(anio);
  }

  if (fecha_inicio) {
    condiciones.push("m.fecha_matricula >= ?");
    valores.push(fecha_inicio);
  }

  if (fecha_fin) {
    condiciones.push("m.fecha_matricula <= ?");
    valores.push(fecha_fin);
  }

  if (busqueda && String(busqueda).trim()) {
    condiciones.push(`
      (
        p.nombre LIKE ?
        OR p.apellido1 LIKE ?
        OR p.apellido2 LIKE ?
        OR g.nombre_grupo LIKE ?
      )
    `);

    const texto = `%${String(busqueda).trim()}%`;

    valores.push(
      texto,
      texto,
      texto,
      texto
    );
  }

  const where =
    condiciones.length > 0
      ? `WHERE ${condiciones.join(" AND ")}`
      : "";

  const [filas] = await pool.query(
    `SELECT
        m.id_matricula,
        m.fecha_matricula AS fecha,
        m.periodo_lectivo,
        m.anio_lectivo,
        m.tipo_matricula,
        m.estado_matricula,
        m.observaciones,
        m.id_estudiante,

        p.nombre AS estudiante_nombre,
        p.apellido1 AS estudiante_apellido1,
        p.apellido2 AS estudiante_apellido2,

        dm.id_grupo,
        g.nombre_grupo,

        s.nombre_seccion,
        s.nivel

     FROM matricula m

     INNER JOIN estudiante e
       ON m.id_estudiante = e.id_estudiante

     INNER JOIN persona p
       ON e.id_persona = p.id_persona

     LEFT JOIN detalle_matricula dm
       ON m.id_matricula = dm.id_matricula
       AND dm.estado = TRUE

     LEFT JOIN grupo g
       ON dm.id_grupo = g.id_grupo

     LEFT JOIN seccion s
       ON g.id_seccion = s.id_seccion

     ${where}

     ORDER BY
       m.fecha_matricula DESC,
       m.id_matricula DESC

     LIMIT 500`, 
    valores
  );

  return filas;
} 

/* ==========================================
   GESTIÓN DE MATRÍCULA POR ESTUDIANTE
   (retirar de un grupo o transferir a otro)
   ========================================== */

/**
 * Retira a un estudiante de un grupo sin reasignarlo a otro.
 * Cierra su vínculo activo en grupo_estudiante y su detalle_matricula
 * asociado a ese grupo, pero conserva el historial (no se borra nada).
 */
export async function retirarEstudianteGrupoService(idGrupo, idEstudiante) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [geRows] = await connection.query(
      "SELECT id_grupo_estudiante FROM grupo_estudiante WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE",
      [idGrupo, idEstudiante]
    );
    if (geRows.length === 0) {
      throw new Error("El estudiante no está activo en este grupo.");
    }

    await connection.query(
      "UPDATE grupo_estudiante SET estado = FALSE WHERE id_grupo_estudiante = ?",
      [geRows[0].id_grupo_estudiante]
    );

    await connection.query(
      `UPDATE detalle_matricula dm
       INNER JOIN matricula m ON dm.id_matricula = m.id_matricula
       SET dm.estado = FALSE
       WHERE dm.id_grupo = ? AND m.id_estudiante = ? AND dm.estado = TRUE`,
      [idGrupo, idEstudiante]
    );

    await connection.commit();
    return { mensaje: "Estudiante retirado del grupo correctamente." };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Transfiere a un estudiante de su grupo actual a un grupo nuevo.
 * 1. Cierra el vínculo activo con el grupo de origen (igual que retirar).
 * 2. Registra una matrícula nueva en el grupo destino reutilizando
 *    procesarMatricula(), que ya valida cupo, duplicados, estudiante y
 *    usuario activos. Así queda historial de ambas matrículas.
 *
 * Nota: los pasos 1 y 2 no comparten conexión/transacción porque
 * procesarMatricula abre la suya propia. Si el paso 2 falla, el estudiante
 * queda sin grupo activo y se avisa explícitamente en el mensaje de error
 * para que se reintente la matrícula al nuevo grupo manualmente.
 */
export async function transferirEstudianteGrupoService(datos) {
  const {
    id_estudiante, id_grupo_actual, id_grupo_nuevo,
    fecha, periodo, anio, tipo, estado, observaciones, id_usuario
  } = datos;

  const idActual = Number(id_grupo_actual);
  const idNuevo = Number(id_grupo_nuevo);
  const idEstudiante = Number(id_estudiante);
  const idUsuario = Number(id_usuario);
  if (!Number.isInteger(idActual) || !Number.isInteger(idNuevo) || !Number.isInteger(idEstudiante) || !Number.isInteger(idUsuario)) {
    throw new Error('Los datos de la transferencia no son válidos.');
  }
  if (idActual === idNuevo) throw new Error('El grupo destino debe ser diferente al grupo actual.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[estudiante]] = await connection.query(
      `SELECT estado FROM estudiante WHERE id_estudiante = ? FOR UPDATE`, [idEstudiante]
    );
    if (!estudiante || !estudiante.estado) throw new Error('El estudiante no existe o está inactivo.');

    const [[usuario]] = await connection.query(
      `SELECT estado FROM usuario WHERE id_usuario = ? LIMIT 1`, [idUsuario]
    );
    if (!usuario || !usuario.estado) throw new Error('El usuario que procesa la transferencia no es válido.');

    const [[origen]] = await connection.query(
      `SELECT ge.id_grupo_estudiante
       FROM grupo_estudiante ge
       INNER JOIN grupo g ON g.id_grupo = ge.id_grupo
       WHERE ge.id_grupo = ? AND ge.id_estudiante = ? AND ge.estado = TRUE AND g.estado = TRUE
       LIMIT 1 FOR UPDATE`,
      [idActual, idEstudiante]
    );
    if (!origen) throw new Error('El estudiante no está activo en el grupo de origen.');

    const [[destino]] = await connection.query(
      `SELECT g.id_grupo, g.capacidad, g.estado, s.periodo_lectivo,
              fn_estudiantes_grupo(g.id_grupo) AS ocupados
       FROM grupo g
       INNER JOIN seccion s ON s.id_seccion = g.id_seccion
       WHERE g.id_grupo = ? LIMIT 1 FOR UPDATE`,
      [idNuevo]
    );
    if (!destino || !destino.estado) throw new Error('El grupo destino no existe o está inactivo.');
    if (Number(destino.ocupados || 0) >= Number(destino.capacidad || 0)) throw new Error('El grupo destino ya no tiene cupo disponible.');
    if (Number(destino.periodo_lectivo) !== Number(anio)) throw new Error('El grupo destino pertenece a un año lectivo diferente.');

    const [yaDestino] = await connection.query(
      `SELECT id_grupo_estudiante FROM grupo_estudiante
       WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE LIMIT 1`,
      [idNuevo, idEstudiante]
    );
    if (yaDestino.length) throw new Error('El estudiante ya está activo en el grupo destino.');

    // Todo ocurre dentro de la misma transacción: si falla el alta en el nuevo
    // grupo, el estudiante permanece en su grupo original.
    await connection.query(
      `UPDATE grupo_estudiante SET estado = FALSE
       WHERE id_grupo_estudiante = ?`, [origen.id_grupo_estudiante]
    );
    await connection.query(
      `UPDATE detalle_matricula dm
       INNER JOIN matricula m ON dm.id_matricula = m.id_matricula
       SET dm.estado = FALSE
       WHERE dm.id_grupo = ? AND m.id_estudiante = ? AND dm.estado = TRUE`,
      [idActual, idEstudiante]
    );

    await connection.query(
      `CALL sp_registrar_matricula(?, ?, ?, ?, ?, ?, ?, ?)`,
      [fecha, periodo, anio, tipo, estado, String(observaciones || '').trim().slice(0,150) || null, idEstudiante, idUsuario]
    );
    const [[last]] = await connection.query(`SELECT LAST_INSERT_ID() AS id_matricula`);
    const idMatricula = Number(last?.id_matricula || 0);
    if (!idMatricula) throw new Error('No se pudo crear la matrícula de transferencia.');

    await connection.query(
      `CALL sp_registrar_detalle_matricula(?, ?, ?, ?)`,
      [fecha, String(observaciones || '').trim().slice(0,150) || null, idMatricula, idNuevo]
    );
    await connection.query(
      `CALL sp_asignar_estudiante_grupo(?, ?, ?)`,
      [fecha, idNuevo, idEstudiante]
    );

    await connection.commit();
    return {
      mensaje: 'Transferencia completada correctamente.',
      id_matricula: idMatricula,
      id_estudiante: idEstudiante,
      id_grupo_anterior: idActual,
      id_grupo_nuevo: idNuevo
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default procesarMatricula;