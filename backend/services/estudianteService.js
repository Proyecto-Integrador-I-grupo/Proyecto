import conexionPromise from "../config/database.js";

const normalizarGenero = (genero) => {
  const valor = String(genero ?? "").trim().toLowerCase();
  const mapa = {
    m: "M",
    masculino: "M",
    f: "F",
    femenino: "F",
    o: "O",
    otro: "O",
    otra: "O"
  };

  const normalizado = mapa[valor];
  if (!normalizado) {
    throw new Error("El género debe ser Masculino, Femenino u Otro.");
  }
  return normalizado;
};

/**
 * Obtiene la lista de estudiantes pendientes de matrícula (pre-registro).
 * IMPORTANTE: esto consulta la tabla `estudiante`, NO la tabla `persona` completa.
 * Así los profesores (que también tienen fila en `persona`) nunca aparecen aquí.
 * Además, excluye a quien YA tiene un grupo activo asignado (grupo_estudiante.estado = TRUE),
 * es decir, a quien ya se matriculó de verdad desde el módulo de Procesos. Así, en cuanto
 * se procesa una matrícula, el estudiante desaparece automáticamente de este listado.
 */
export const obtenerEstudiantesService = async () => {
  const query = `
    SELECT 
      e.id_estudiante,
      e.id_persona,
      p.nombre,
      p.apellido1,
      p.apellido2,
      p.fecha_nacimiento,
      p.genero,
      e.fecha_ingreso,
      e.estado
    FROM estudiante e
    INNER JOIN persona p ON e.id_persona = p.id_persona
    WHERE e.estado = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM grupo_estudiante ge
        WHERE ge.id_estudiante = e.id_estudiante AND ge.estado = TRUE
      )
    ORDER BY e.id_estudiante DESC
  `;
  const [rows] = await conexionPromise.query(query);
  return rows;
};

/**
 * Obtiene los estudiantes que ya tienen una matrícula activa
 * y actualmente pertenecen a un grupo.
 */
export const obtenerEstudiantesMatriculadosService = async () => {
  const query = `
    SELECT
      e.id_estudiante,
      e.id_persona,

      p.nombre,
      p.apellido1,
      p.apellido2,
      p.fecha_nacimiento,
      p.genero,

      e.fecha_ingreso,
      e.estado,

      ge.fecha_asignacion,
      ge.id_grupo,

      g.nombre_grupo,
      g.aula,

      s.id_seccion,
      s.nombre_seccion,
      s.nivel,
      s.periodo_lectivo,

      m.id_matricula,
      m.fecha_matricula,
      m.tipo_matricula,
      m.estado_matricula

    FROM grupo_estudiante ge

    INNER JOIN estudiante e
      ON ge.id_estudiante = e.id_estudiante

    INNER JOIN persona p
      ON e.id_persona = p.id_persona

    INNER JOIN grupo g
      ON ge.id_grupo = g.id_grupo

    INNER JOIN seccion s
      ON g.id_seccion = s.id_seccion

    LEFT JOIN (
      SELECT
        m1.id_estudiante,
        dm1.id_grupo,
        MAX(m1.id_matricula) AS id_matricula
      FROM matricula m1
      INNER JOIN detalle_matricula dm1
        ON m1.id_matricula = dm1.id_matricula
      WHERE dm1.estado = TRUE
      GROUP BY
        m1.id_estudiante,
        dm1.id_grupo
    ) ultima_matricula
      ON ultima_matricula.id_estudiante = e.id_estudiante
      AND ultima_matricula.id_grupo = ge.id_grupo

    LEFT JOIN matricula m
      ON m.id_matricula = ultima_matricula.id_matricula

    WHERE ge.estado = TRUE
      AND e.estado = TRUE
      AND g.estado = TRUE

    ORDER BY
      s.nivel,
      g.nombre_grupo,
      p.apellido1,
      p.apellido2,
      p.nombre
  `;

  const [rows] = await conexionPromise.query(query);

  return rows;
};


/**
 * Obtiene un estudiante puntual por su id_estudiante (no por id_persona).
 */
export const obtenerEstudiantePorIdService = async (id_estudiante) => {
  const query = `
    SELECT 
      e.id_estudiante,
      e.id_persona,
      p.nombre,
      p.apellido1,
      p.apellido2,
      p.fecha_nacimiento,
      p.genero,
      e.fecha_ingreso,
      e.estado
    FROM estudiante e
    INNER JOIN persona p ON e.id_persona = p.id_persona
    WHERE e.id_estudiante = ?
    LIMIT 1
  `;
  const [rows] = await conexionPromise.query(query, [id_estudiante]);
  return rows[0];
};

/**
 * Registra un estudiante insertando la persona y el estudiante dentro de una transacción.
 * Misma lógica de transacción que profesorService.crearProfesorService, pero apuntando
 * a la tabla `estudiante` en vez de `profesor`.
 */
export const crearEstudianteService = async (datos, idUsuario = null) => {
  const { nombre, apellido1, apellido2, fecha_nacimiento, genero, fecha_ingreso } = datos;

  if (!nombre || !apellido1 || !fecha_nacimiento || !genero) {
    throw new Error("Faltan campos obligatorios para registrar al estudiante.");
  }

  const generoNormalizado = normalizarGenero(genero);
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    // Desactivamos temporalmente los triggers en esta sesión para evitar el bloqueo de auditoría
    await connection.query(`SET @DISABLE_TRIGGERS = 1`);

    // 1. Insertar persona
    const queryPersona = `
      INSERT INTO persona (nombre, apellido1, apellido2, fecha_nacimiento, genero, estado)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `;
    const [resPersona] = await connection.query(queryPersona, [
      nombre.trim(),
      apellido1.trim(),
      apellido2 ? apellido2.trim() : null,
      fecha_nacimiento,
      generoNormalizado
    ]);

    const id_persona = resPersona.insertId;

    // 2. Insertar estudiante enlazado
    const queryEstudiante = `
      INSERT INTO estudiante (id_persona, fecha_ingreso, estado)
      VALUES (?, ?, TRUE)
    `;
    const [resEstudiante] = await connection.query(queryEstudiante, [
      id_persona,
      fecha_ingreso || new Date().toISOString().split("T")[0]
    ]);

    // Reactivamos los triggers
    await connection.query(`SET @DISABLE_TRIGGERS = NULL`);

    await connection.commit();

    return {
      id_estudiante: resEstudiante.insertId,
      id_persona,
      nombre,
      apellido1,
      apellido2,
      fecha_ingreso,
      estado: 1
    };
  } catch (error) {
    await connection.rollback();
    try { await connection.query(`SET @DISABLE_TRIGGERS = NULL`); } catch (e) {}

    throw new Error(error.message || "Error interno al registrar el estudiante en la base de datos.");
  } finally {
    connection.release();
  }
};

/**
 * Actualiza los datos personales del estudiante (persona asociada).
 * Recibe id_estudiante, resuelve internamente el id_persona correspondiente.
 */
export const actualizarEstudianteService = async (id_estudiante, datos, idUsuario = null) => {
  const { nombre, apellido1, apellido2, fecha_nacimiento, genero } = datos;
  const generoNormalizado = normalizarGenero(genero);

  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [estRows] = await connection.query(
      `SELECT id_persona FROM estudiante WHERE id_estudiante = ?`,
      [id_estudiante]
    );

    if (estRows.length === 0) {
      throw new Error("Estudiante no encontrado.");
    }

    const id_persona = estRows[0].id_persona;

    await connection.query(
      `UPDATE persona 
       SET nombre = ?, apellido1 = ?, apellido2 = ?, fecha_nacimiento = ?, genero = ?
       WHERE id_persona = ?`,
      [nombre, apellido1, apellido2 || null, fecha_nacimiento, generoNormalizado, id_persona]
    );

    await connection.commit();
    return { id_estudiante, id_persona, mensaje: "Estudiante actualizado correctamente" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Elimina (borrado lógico) a un estudiante, marcando estado = FALSE en la tabla `estudiante`.
 * Esto es distinto de eliminar la persona: la persona se conserva por trazabilidad/auditoría.
 */
export const eliminarEstudianteService = async (id_estudiante) => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [estRows] = await connection.query(
      `SELECT id_estudiante FROM estudiante WHERE id_estudiante = ?`,
      [id_estudiante]
    );

    if (estRows.length === 0) {
      throw new Error("Estudiante no encontrado.");
    }

    await connection.query(
      `UPDATE estudiante SET estado = FALSE WHERE id_estudiante = ?`,
      [id_estudiante]
    );

    await connection.commit();
    return { id_estudiante, mensaje: "Estudiante eliminado correctamente" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};