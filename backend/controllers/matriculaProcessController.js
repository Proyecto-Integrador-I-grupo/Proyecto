import {
  procesarMatricula,
  obtenerGruposService,
  crearGrupoService,
  actualizarGrupoService,
  eliminarGrupoService,
  obtenerDetalleGrupoService,
  listarMatriculasService
} from "../services/matriculaServiceP.js";

import * as auditoriaModel from "../models/auditoriaModel.js";

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

export default crearMatricula;