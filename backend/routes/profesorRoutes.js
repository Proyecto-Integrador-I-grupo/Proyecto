import { Router } from "express";
import {
  getProfesores,
  createProfesor,
  destituirProfesor,
  eliminarProfesor,
  reasignarGrupo
} from "../controllers/profesorController.js";

const router = Router();

router.get("/", getProfesores);
router.post("/", createProfesor);
router.put("/:id/destituir", destituirProfesor);
router.put("/reasignar", reasignarGrupo);
router.delete("/:id", eliminarProfesor);

export default router;