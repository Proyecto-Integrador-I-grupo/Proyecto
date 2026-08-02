import express from "express";
import { body } from "express-validator";
import {
  crearMatricula,
  obtenerGrupos,
  crearGrupo,
  actualizarGrupo,
  obtenerDetalleGrupo
} from "../controllers/matriculaProcessController.js";
import { validarCampos } from "../middleware/validationMiddleware.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const validarMatricula = [
  body("fecha").notEmpty().withMessage("La fecha es obligatoria.")
    .isISO8601().withMessage("La fecha no tiene un formato válido."),
  // periodo_lectivo en la tabla `matricula` es SMALLINT (trimestre), no el
  // nombre del mes. Se limita a 1-4 para cubrir esquemas trimestrales o cuatrimestrales.
  body("periodo").isInt({ min: 1, max: 4 }).withMessage("El período (trimestre) debe ser un número entre 1 y 4."),
  body("anio").isInt({ min: 2000, max: 2100 }).withMessage("El año lectivo no es válido."),
  body("tipo").notEmpty().isLength({ max: 20 }).withMessage("El tipo de matrícula es obligatorio (máx. 20 caracteres)."),
  body("estado").notEmpty().isLength({ max: 20 }).withMessage("El estado de la matrícula es obligatorio (máx. 20 caracteres)."),
  // sp_registrar_matricula declara p_observaciones VARCHAR(20): si se manda más,
  // MySQL en modo estricto revienta la transacción. Se valida aquí para avisar
  // al usuario ANTES de llegar a la base de datos (el servicio también lo recorta
  // por seguridad, pero es mejor que el usuario sepa por qué se cortó).
  body("observaciones").optional({ nullable: true }).isLength({ max: 20 })
    .withMessage("Las observaciones no pueden superar 20 caracteres (limitación del procedimiento de matrícula)."),
  body("id_estudiante").isInt({ min: 1 }).withMessage("Debe seleccionar un estudiante."),
  body("id_usuario").isInt({ min: 1 }).withMessage("Falta el usuario que procesa la matrícula."),
  body("id_grupo").isInt({ min: 1 }).withMessage("Debe seleccionar un grupo.")
];

const validarGrupo = [
  body("nombre_grupo").trim().notEmpty().withMessage("El nombre del grupo es obligatorio."),
  body("capacidad").isInt({ min: 1 }).withMessage("La capacidad debe ser un número entero mayor a cero."),
  body("id_profesor").isInt({ min: 1 }).withMessage("Debe asignar un profesor encargado."),
  body("id_seccion").isInt({ min: 1 }).withMessage("Debe seleccionar una sección académica.")
];

const validarGrupoUpdate = [
  body("capacidad").isInt({ min: 1 }).withMessage("La capacidad debe ser un número entero mayor a cero."),
  body("id_profesor").isInt({ min: 1 }).withMessage("Debe asignar un profesor encargado.")
];

// Matrícula
router.post("/matricula", requireAuth, validarMatricula, validarCampos, crearMatricula);

// Grupos
router.get("/grupos", obtenerGrupos);
router.post("/grupos", requireAuth, validarGrupo, validarCampos, crearGrupo);
router.put("/grupos/:id", requireAuth, validarGrupoUpdate, validarCampos, actualizarGrupo);
router.get("/grupos/:id/detalle", obtenerDetalleGrupo);

export default router;