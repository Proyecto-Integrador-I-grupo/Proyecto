import { Router } from "express";
import {
  getEstudiantes,
  getEstudiantesMatriculados,
  getEstudiantePorId,
  createEstudiante,
  updateEstudiante,
  deleteEstudiante
} from "../controllers/estudianteController.js";

const router = Router();

router.get("/", getEstudiantes);
router.get("/matriculados", getEstudiantesMatriculados);
router.get("/:id", getEstudiantePorId);
router.post("/", createEstudiante);
router.put("/:id", updateEstudiante);
router.delete("/:id", deleteEstudiante);

export default router;