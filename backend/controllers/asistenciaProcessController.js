import {
  procesarMatricula,
  obtenerGruposService,
  crearGrupoService,
  actualizarGrupoService,
  eliminarGrupoService,
  obtenerDetalleGrupoService,
  listarMatriculasService,
  retirarEstudianteGrupoService,
  transferirEstudianteGrupoService
} from "../services/matriculaServiceP.js";

import * as auditoriaModel from "../models/auditoriaModel.js";
import conexion from "../config/database.js";

/* ==========================================
   MATRÍCULAS
   ========================================== */

export async function crearMatricula(req, res) {
  try {
    const resultado = await procesarMatricula(req.body);

    try {
      await auditoriaModel.crearAuditoria(
        {
          nombre_tabla: "matricula",
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
    // FIX #1: el campo real del rol en el usuario autenticado (ver usuarioModel.js) es "nom_rol".
    const rol = (usuario?.nom_rol || "").toLowerCase();

    // Si es profesor, filtramos estrictamente por sus grupos asignados o suplencias activas
    if (rol === "profesor") {
      const idProfesor = usuario.id_profesor;
      if (!idProfesor) {
        return res.json([]);
      }

      // FIX #3: "grupo" NO tiene columna "id_profesor" (confirmado por el error de MySQL
      // "Unknown column 'g.id_profesor'"). La relación profesor-grupo vive en la tabla
      // "grupo_profesor" (columnas id_grupo, id_profesor, estado).
      const sqlProfesorGrupos = `
        SELECT DISTINCT g.* 
        FROM grupo g
        LEFT JOIN grupo_profesor gp     ON gp.id_grupo = g.id_grupo AND gp.estado = TRUE
        LEFT JOIN profesor_suplencia s  ON s.id_grupo = g.id_grupo AND s.estado = TRUE
        WHERE gp.id_profesor = ? OR s.id_profesor_suplente = ?
      `;
      const [rows] = await conexion.query(sqlProfesorGrupos, [idProfesor, idProfesor]);
      return res.json(rows);
    }

    // Para administradores o asistentes, se devuelven todos los grupos normalmente
    const grupos = await obtenerGruposService();
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
    const resultado = await transferirEstudianteGrupoService(req.body);

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