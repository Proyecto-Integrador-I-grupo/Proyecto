import {
  procesarMatricula,
  obtenerGruposService,
  crearGrupoService,
  actualizarGrupoService,
  eliminarGrupoService,
  obtenerDetalleGrupoService,
  listarMatriculasService,
  retirarEstudianteGrupoService,
  transferirEstudianteGrupoService,
  obtenerHorarioAcademicoGrupoService,
  guardarHorarioAcademicoGrupoService
} from "../services/matriculaServiceP.js";

import * as auditoriaModel from "../models/auditoriaModel.js";
import conexion from "../config/database.js";
import { crearCargoMatriculaSiCorresponde } from "../services/finanzaService.js";

/* ==========================================
   MATRÍCULAS
   ========================================== */

export async function crearMatricula(req, res) {
  try {
    const payload = { ...req.body, id_usuario: req.usuarioActual?.id_usuario };
    const resultado = await procesarMatricula(payload);

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "matricula",
          accion_usuario: "INSERT",
          datos_anteriores: "",
          datos_nuevos: JSON.stringify(payload)
        },
        req.usuarioActual?.id_usuario ?? null
      );
    } catch (errorAuditoria) {
      console.error(
        "Error registrando auditoría:",
        errorAuditoria
      );
    }

    let cargo = null;
    try {
      cargo = await crearCargoMatriculaSiCorresponde({
        id_matricula: resultado.id_matricula,
        id_estudiante: payload.id_estudiante,
        id_usuario: req.usuarioActual?.id_usuario ?? req.body.id_usuario ?? null,
        anio: payload.anio
      });
    } catch (errorCargo) {
      console.error("No se pudo generar automáticamente el cargo de matrícula:", errorCargo);
    }

    res.status(201).json({ ...resultado, cargo });
  } catch (error) {
    res.status(400).json({
      mensaje: error.message
    });
  }
}

export async function obtenerMatriculas(req, res) {
  try {
    const matriculas = await listarMatriculasService(
      req.query
    );

    res.status(200).json(matriculas);
  } catch (error) {
    console.error(
      "Error al obtener matrículas:",
      error
    );

    res.status(500).json({
      mensaje:
        error.message ||
        "No se pudieron obtener las matrículas."
    });
  }
}

/* ==========================================
   GRUPOS
   ========================================== */

export async function obtenerGrupos(req, res) {
  try {
    const usuario = req.usuarioActual;
    const rol = (usuario?.nom_rol || "").toLowerCase();

    // Si es profesor, filtramos estrictamente por sus grupos asignados o suplencias activas
    if (rol === "profesor") {
      const idProfesor = usuario.id_profesor;
      if (!idProfesor) {
        return res.json([]);
      }

      const sqlProfesorGrupos = `
        SELECT DISTINCT 
          g.id_grupo,
          g.nombre_grupo,
          g.capacidad,
          g.aula,
          g.dias_semana,
          g.hora_inicio,
          g.hora_fin,
          g.id_seccion,
          s.nombre_seccion,
          s.nivel,
          s.periodo_lectivo,
          fn_estudiantes_grupo(g.id_grupo) AS ocupados
        FROM grupo g
        INNER JOIN seccion s ON g.id_seccion = s.id_seccion
        LEFT JOIN grupo_profesor gp ON gp.id_grupo = g.id_grupo AND gp.estado = TRUE
        LEFT JOIN profesor_suplencia s_sup ON s_sup.id_grupo = g.id_grupo AND s_sup.estado = TRUE
        WHERE g.estado = TRUE AND (gp.id_profesor = ? OR s_sup.id_profesor_suplente = ?)
        ORDER BY s.periodo_lectivo DESC, s.nivel, g.nombre_grupo
      `;
      const [rows] = await conexion.query(sqlProfesorGrupos, [idProfesor, idProfesor]);
      return res.json(rows);
    }

    // Para administradores o asistentes, se devuelven todos los grupos normalmente
    const grupos = await obtenerGruposService(usuario);
    res.json(grupos);
  } catch (error) {
    res.status(500).json({
      mensaje: error.message
    });
  }
}

export async function crearGrupo(req, res) {
  try {
    const resultado = await crearGrupoService(req.body);

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "grupo",
          accion_usuario: "INSERT",
          datos_anteriores: "",
          datos_nuevos: JSON.stringify(req.body)
        },
        req.usuarioActual?.id_usuario ?? null
      );
    } catch (errorAuditoria) {
      console.error(
        "Error registrando auditoría:",
        errorAuditoria
      );
    }

    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({
      mensaje: error.message
    });
  }
}

export async function actualizarGrupo(req, res) {
  try {
    const { id } = req.params;

    const resultado = await actualizarGrupoService(
      Number(id),
      req.body
    );

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "grupo",
          accion_usuario: "UPDATE",
          datos_anteriores: JSON.stringify({
            id_grupo: Number(id)
          }),
          datos_nuevos: JSON.stringify({
            ...req.body,
            id_grupo: Number(id)
          })
        },
        req.usuarioActual?.id_usuario ?? null
      );
    } catch (errorAuditoria) {
      console.error(
        "Error registrando auditoría:",
        errorAuditoria
      );
    }

    res.json(resultado);
  } catch (error) {
    res.status(400).json({
      mensaje: error.message
    });
  }
}

export async function eliminarGrupo(req, res) {
  try {
    const { id } = req.params;

    const resultado = await eliminarGrupoService(Number(id));

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "grupo",
          accion_usuario: "DELETE",
          datos_anteriores: JSON.stringify({
            id_grupo: Number(id)
          }),
          datos_nuevos: JSON.stringify({ estado: false })
        },
        req.usuarioActual?.id_usuario ?? null
      );
    } catch (errorAuditoria) {
      console.error(
        "Error registrando auditoría:",
        errorAuditoria
      );
    }

    res.json(resultado);
  } catch (error) {
    res.status(400).json({
      mensaje: error.message
    });
  }
}

export async function obtenerDetalleGrupo(req, res) {
  try {
    const { id } = req.params;

    const detalle = await obtenerDetalleGrupoService(id);

    res.json(detalle);
  } catch (error) {
    res.status(500).json({
      mensaje: error.message
    });
  }
}

/* ==========================================
   GESTIÓN DE MATRÍCULA POR ESTUDIANTE
   ========================================== */

export async function retirarEstudianteGrupo(req, res) {
  try {
    const { id } = req.params; // id_grupo
    const { id_estudiante } = req.body;

    if (!id_estudiante) {
      return res.status(400).json({ mensaje: "Debe indicar el estudiante a retirar." });
    }

    const resultado = await retirarEstudianteGrupoService(Number(id), Number(id_estudiante));

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "grupo_estudiante",
          accion_usuario: "UPDATE",
          datos_anteriores: JSON.stringify({ id_grupo: Number(id), id_estudiante: Number(id_estudiante), estado: true }),
          datos_nuevos: JSON.stringify({ id_grupo: Number(id), id_estudiante: Number(id_estudiante), estado: false })
        },
        req.usuarioActual?.id_usuario ?? null
      );
    } catch (errorAuditoria) {
      console.error("Error registrando auditoría:", errorAuditoria);
    }

    res.json(resultado);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export async function transferirEstudianteGrupo(req, res) {
  try {
    const payload = { ...req.body, id_usuario: req.usuarioActual?.id_usuario };
    const resultado = await transferirEstudianteGrupoService(payload);

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "grupo_estudiante",
          accion_usuario: "UPDATE",
          datos_anteriores: JSON.stringify({
            id_estudiante: req.body.id_estudiante,
            id_grupo_actual: req.body.id_grupo_actual
          }),
          datos_nuevos: JSON.stringify({
            id_estudiante: req.body.id_estudiante,
            id_grupo_nuevo: req.body.id_grupo_nuevo
          })
        },
        req.usuarioActual?.id_usuario ?? null
      );
    } catch (errorAuditoria) {
      console.error("Error registrando auditoría:", errorAuditoria);
    }

    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export default crearMatricula;

export async function obtenerHorarioGrupo(req, res) {
  try {
    const bloques = await obtenerHorarioAcademicoGrupoService(Number(req.params.id));
    res.json({ bloques });
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo consultar el horario del grupo.' });
  }
}

export async function guardarHorarioGrupo(req, res) {
  try {
    const resultado = await guardarHorarioAcademicoGrupoService(Number(req.params.id), req.body?.bloques || []);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo guardar el horario del grupo.' });
  }
}
