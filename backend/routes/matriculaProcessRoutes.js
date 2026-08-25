import express from "express";
import { body } from "express-validator";
import {
  crearMatricula,
  obtenerMatriculas,
  obtenerGrupos,
  crearGrupo,
  actualizarGrupo,
  eliminarGrupo,
  obtenerDetalleGrupo,
  retirarEstudianteGrupo,
  transferirEstudianteGrupo
} from "../controllers/matriculaProcessController.js";
import { validarCampos } from "../middleware/validationMiddleware.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

const validarMatricula = [
  body("fecha").notEmpty().withMessage("La fecha es obligatoria.")
    .isISO8601().withMessage("La fecha no tiene un formato válido."),
  body("periodo").isInt({ min: 1, max: 4 }).withMessage("El período (trimestre) debe ser un número entre 1 y 4."),
  body("anio").isInt({ min: 2000, max: 2100 }).withMessage("El año lectivo no es válido."),
  body("tipo").notEmpty().isLength({ max: 20 }).withMessage("El tipo de matrícula es obligatorio (máx. 20 caracteres)."),
  body("estado").notEmpty().isLength({ max: 20 }).withMessage("El estado de la matrícula es obligatorio (máx. 20 caracteres)."),
  body("observaciones").optional({ nullable: true }).isLength({ max: 150 })
    .withMessage("Las observaciones no pueden superar 150 caracteres."),
  body("id_estudiante").isInt({ min: 1 }).withMessage("Debe seleccionar un estudiante."),
  body("id_grupo").isInt({ min: 1 }).withMessage("Debe seleccionar un grupo.")
];

const validarGrupo = [
  body("nombre_grupo").trim().notEmpty().withMessage("El nombre del grupo es obligatorio."),
  body("capacidad").isInt({ min: 1 }).withMessage("La capacidad debe ser un número entero mayor a cero."),
  body("id_seccion").isInt({ min: 1 }).withMessage("Debe seleccionar una sección académica."),
  body("dias_semana").isArray({ min: 1, max: 6 }).withMessage("Selecciona al menos un día de clase."),
  body("hora_inicio").notEmpty().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("La hora de inicio no es válida."),
  body("hora_fin").notEmpty().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("La hora de finalización no es válida.")
];

const validarGrupoUpdate = [
  body("capacidad").isInt({ min: 1 }).withMessage("La capacidad debe ser un número entero mayor a cero."),
  body("dias_semana").isArray({ min: 1, max: 6 }).withMessage("Selecciona al menos un día de clase."),
  body("hora_inicio").notEmpty().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("La hora de inicio no es válida."),
  body("hora_fin").notEmpty().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("La hora de finalización no es válida.")
];

const validarRetiroEstudiante = [
  body("id_estudiante").isInt({ min: 1 }).withMessage("Debe indicar el estudiante a retirar.")
];

const validarTransferenciaEstudiante = [
  body("fecha").notEmpty().withMessage("La fecha es obligatoria.")
    .isISO8601().withMessage("La fecha no tiene un formato válido."),
  body("periodo").isInt({ min: 1, max: 4 }).withMessage("El período (trimestre) debe ser un número entre 1 y 4."),
  body("anio").isInt({ min: 2000, max: 2100 }).withMessage("El año lectivo no es válido."),
  body("tipo").notEmpty().isLength({ max: 20 }).withMessage("El tipo de matrícula es obligatorio (máx. 20 caracteres)."),
  body("estado").notEmpty().isLength({ max: 20 }).withMessage("El estado de la matrícula es obligatorio (máx. 20 caracteres)."),
  body("observaciones").optional({ nullable: true }).isLength({ max: 150 })
    .withMessage("Las observaciones no pueden superar 150 caracteres."),
  body("id_estudiante").isInt({ min: 1 }).withMessage("Debe indicar el estudiante."),
  body("id_grupo_actual").isInt({ min: 1 }).withMessage("Debe indicar el grupo de origen."),
  body("id_grupo_nuevo").isInt({ min: 1 }).withMessage("Debe seleccionar el grupo destino.")
];

// Matrícula
router.get("/matricula", requireAuth, obtenerMatriculas);
router.post("/matricula", requireAuth, requireRole("Administrador", "Asistente"), validarMatricula, validarCampos, crearMatricula);
router.post("/matricula/transferir", requireAuth, requireRole("Administrador", "Asistente"), validarTransferenciaEstudiante, validarCampos, transferirEstudianteGrupo);

// Grupos
router.get("/grupos", requireAuth, obtenerGrupos);
router.post("/grupos", requireAuth, requireRole("Administrador", "Asistente"), validarGrupo, validarCampos, crearGrupo);
router.put("/grupos/:id", requireAuth, requireRole("Administrador", "Asistente"), validarGrupoUpdate, validarCampos, actualizarGrupo);
router.delete("/grupos/:id", requireAuth, requireRole("Administrador"), eliminarGrupo);
router.get("/grupos/:id/detalle", requireAuth, obtenerDetalleGrupo);
router.put("/grupos/:id/retirar-estudiante", requireAuth, requireRole("Administrador", "Asistente"), validarRetiroEstudiante, validarCampos, retirarEstudianteGrupo);

export default router;