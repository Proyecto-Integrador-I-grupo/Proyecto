import { Router } from "express";
import {
  getProfesores,
  createProfesor,
  destituirProfesor,
  reintegrarProfesor,
  eliminarProfesor,
  reasignarGrupo,
  getSuplenciasPendientes
} from "../controllers/profesorController.js";

const router = Router();

router.get("/", getProfesores);
router.get("/suplencias/pendientes", getSuplenciasPendientes);
router.post("/", createProfesor);
router.put("/:id/destituir", destituirProfesor);
router.put("/:id/reintegrar", reintegrarProfesor);
router.put("/reasignar", reasignarGrupo);
router.delete("/:id", eliminarProfesor);

export default router;