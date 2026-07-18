import express from "express";
import { crearMatricula } from "../controllers/matriculaProcessController.js";

const router = express.Router();

router.post("/matricula", crearMatricula);

export default router;