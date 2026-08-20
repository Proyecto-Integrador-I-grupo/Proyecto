import pool from "../config/database.js";

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
      "SELECT capacidad, estado, fn_estudiantes_grupo(id_grupo) AS ocupados FROM grupo WHERE id_grupo = ? FOR UPDATE",
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
    if (yaEnGrupo.length > 0) {
      throw new Error("El estudiante ya está matriculado en este grupo.");
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
          g.id_seccion,
          s.nombre_seccion,
          s.nivel,
          s.periodo_lectivo,
          fn_estudiantes_grupo(g.id_grupo) AS ocupados
       FROM grupo g
       INNER JOIN seccion s ON g.id_seccion = s.id_seccion
       LEFT JOIN grupo_profesor gp ON gp.id_grupo = g.id_grupo
         AND gp.id_profesor = ? AND gp.estado = TRUE
       LEFT JOIN suplencia su ON su.id_grupo = g.id_grupo
         AND su.id_profesor_suplente = ? AND su.activo = 1
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
  const { nombre_grupo, capacidad, aula, profesores, id_profesor, id_seccion } = datos;

  const nombreLimpio = (nombre_grupo || "").trim();
  const capacidadNum = Number(capacidad);
  const idSeccionNum = Number(id_seccion);

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

    const [result] = await connection.query(
      "INSERT INTO grupo (nombre_grupo, estado, capacidad, aula, id_seccion) VALUES (?, TRUE, ?, ?, ?)",
      [nombreLimpio, capacidadNum, aula ? aula.trim() : null, idSeccionNum]
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
  const { capacidad, aula, id_profesor, profesores } = datos;

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

    await connection.query(
      `UPDATE grupo
       SET capacidad = ?, aula = ?
       WHERE id_grupo = ?`,
      [capacidadNum, aula ? aula.trim() : null, idGrupo]
    );

    if (listaProfesores.length > 0) {
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
  const { id_estudiante, id_grupo_actual, id_grupo_nuevo } = datos;

  if (Number(id_grupo_actual) === Number(id_grupo_nuevo)) {
    throw new Error("El grupo destino debe ser diferente al grupo actual.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [geActual] = await connection.query(
      "SELECT id_grupo_estudiante FROM grupo_estudiante WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE",
      [id_grupo_actual, id_estudiante]
    );
    if (geActual.length === 0) {
      throw new Error("El estudiante no está activo en el grupo de origen.");
    }

    await connection.query(
      "UPDATE grupo_estudiante SET estado = FALSE WHERE id_grupo_estudiante = ?",
      [geActual[0].id_grupo_estudiante]
    );

    await connection.query(
      `UPDATE detalle_matricula dm
       INNER JOIN matricula m ON dm.id_matricula = m.id_matricula
       SET dm.estado = FALSE
       WHERE dm.id_grupo = ? AND m.id_estudiante = ? AND dm.estado = TRUE`,
      [id_grupo_actual, id_estudiante]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    return await procesarMatricula({ ...datos, id_grupo: id_grupo_nuevo, omitir_validacion_financiera: true });
  } catch (error) {
    throw new Error(
      `El estudiante se retiró del grupo anterior, pero no se pudo matricular en el grupo nuevo: ${error.message}`
    );
  }
}

export default procesarMatricula;