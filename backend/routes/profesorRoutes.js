import { Router } from "express";
import {
  getProfesores,
  createProfesor,
  destituirProfesor,
  reintegrarProfesor,
  eliminarProfesor,
  reasignarGrupo,
  asignarGruposProfesor,
  getSuplenciasPendientes
} from "../controllers/profesorController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

// Cualquier usuario autenticado (Administrador, Asistente o Profesor) puede consultar la lista,
// ya que el dashboard y otros módulos la necesitan para mostrar conteos.
router.get("/", requireAuth, getProfesores);

// Gestión del cuerpo docente: solo el Administrador contrata, destituye, reintegra o elimina profesores.
router.get("/suplencias/pendientes", requireAuth, requireRole("Administrador"), getSuplenciasPendientes);
router.post("/", requireAuth, requireRole("Administrador"), createProfesor);
router.put("/:id/destituir", requireAuth, requireRole("Administrador"), destituirProfesor);
router.put("/:id/reintegrar", requireAuth, requireRole("Administrador"), reintegrarProfesor);
router.put("/:id/grupos", requireAuth, requireRole("Administrador"), asignarGruposProfesor);
router.put("/reasignar", requireAuth, requireRole("Administrador"), reasignarGrupo);
router.delete("/:id", requireAuth, requireRole("Administrador"), eliminarProfesor);

export default router;