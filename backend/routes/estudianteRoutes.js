import { Router } from "express";
import {
  getEstudiantes,
  getEstudiantesMatriculados,
  getEstudiantePorId,
  createEstudiante,
  updateEstudiante,
  deleteEstudiante
} from "../controllers/estudianteController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

// Consultas: cualquier usuario autenticado puede leer la información necesaria
// para sus módulos permitidos.
router.get("/", requireAuth, getEstudiantes);
router.get("/matriculados", requireAuth, getEstudiantesMatriculados);
router.get("/:id", requireAuth, getEstudiantePorId);

// Cambios de expediente: Administrador o Asistente.
router.post("/", requireAuth, requireRole("Administrador", "Asistente"), createEstudiante);
router.put("/:id", requireAuth, requireRole("Administrador", "Asistente"), updateEstudiante);
router.delete("/:id", requireAuth, requireRole("Administrador"), deleteEstudiante);

export default router;
