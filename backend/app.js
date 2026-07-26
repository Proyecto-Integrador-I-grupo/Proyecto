import express from "express";
import cors from "cors";

// Importar las rutas
import authRoutes from "./routes/authRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import personaRoutes from "./routes/personaRoutes.js";
import profesorRoutes from "./routes/profesorRoutes.js";
import estudianteRoutes from "./routes/estudianteRoutes.js";
import matriculaProcessRoutes from "./routes/matriculaProcessRoutes.js";
import asistenciaProcessRoutes from "./routes/asistenciaProcessRoutes.js";
import seccionRoutes from "./routes/seccionRoutes.js"; // <-- 1. Asegúrate de importar esto

import { identificarUsuario } from "./middleware/authMiddleware.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(identificarUsuario);

// Ruta principal
app.get("/", (req, res) => {
    res.json({
        mensaje: "Bienvenido a la API del Sistema Escolar"
    });
});

// Rutas de autenticación y usuarios
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuarioRoutes);

// Rutas del módulo Persona, Profesor y Estudiante
app.use("/api/personas", personaRoutes);
app.use("/api/profesores", profesorRoutes);
app.use("/api/estudiantes", estudianteRoutes);

// Rutas de Procesos
app.use("/api/procesos/secciones", seccionRoutes);
app.use("/api/procesos", matriculaProcessRoutes);
app.use("/api/procesos", asistenciaProcessRoutes);

export default app;