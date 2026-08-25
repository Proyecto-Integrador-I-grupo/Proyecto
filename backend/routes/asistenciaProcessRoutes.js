import express from "express";
import { body } from "express-validator";
import {
  crearAsistencia,
  obtenerAsistencias,
  actualizarAsistencia,
  eliminarAsistencia,
  obtenerMateriasDisponibles
} from "../controllers/asistenciaProcessController.js";
import { validarCampos } from "../middleware/validationMiddleware.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/authMiddleware.js";

const router = express.Router();

const validarAsistencia = [
  body("fecha").notEmpty().withMessage("La fecha es obligatoria.")
    .isISO8601().withMessage("La fecha no tiene un formato válido."),
  body("estado_asistencia").trim().notEmpty().isLength({ max: 15 })
    .withMessage("El estado de asistencia es obligatorio (máx. 15 caracteres)."),
  body("observaciones").optional({ nullable: true }).isLength({ max: 250 })
    .withMessage("Las observaciones no pueden superar 250 caracteres."),
  body("id_estudiante").isInt({ min: 1 }).withMessage("Debe seleccionar un estudiante."),
  body("id_grupo").isInt({ min: 1 }).withMessage("Debe seleccionar un grupo."),
  body("id_profesor").isInt({ min: 1 }).withMessage("Debe seleccionar un profesor.")
];

const validarActualizacionAsistencia = [
  body("estado_asistencia").trim().notEmpty().isLength({ max: 15 })
    .withMessage("El estado de asistencia es obligatorio (máx. 15 caracteres)."),
  body("observaciones").optional({ nullable: true }).isLength({ max: 250 })
    .withMessage("Las observaciones no pueden superar 250 caracteres.")
];

// Listado con filtros (grupo, estudiante, profesor, materia, estado, rango de fechas, búsqueda por nombre)
router.get("/asistencia", requireAuth, obtenerAsistencias);

// NUEVO: Lista de materias distintas activas, para poblar el filtro "Materia/Curso"
router.get("/materias", requireAuth, obtenerMateriasDisponibles);

// Registro nuevo de asistencia
router.post("/asistencia", requireAuth, requirePermission("asistencia.registrar"), validarAsistencia, validarCampos, crearAsistencia);

// Modificación / Actualización de un registro de asistencia existente (Soluciona el fallo al modificar ausentes u otros estados)
router.put("/asistencia/:id", requireAuth, requirePermission("asistencia.modificar"), validarActualizacionAsistencia, validarCampos, actualizarAsistencia);

router.delete("/asistencia/:id", requireAuth, requirePermission("asistencia.anular"), eliminarAsistencia);

export default router;