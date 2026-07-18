import express from "express";
import { crearAsistencia } from "../controllers/asistenciaProcessController.js";

const router = express.Router();

router.post("/asistencia", crearAsistencia);

export default router;