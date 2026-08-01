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
import seccionRoutes from "./routes/seccionRoutes.js";
import reporteRoutes from "./routes/reporteRoutes.js";

import { identificarUsuario } from "./middleware/authMiddleware.js";

const app = express();

// Middlewares
// Lista de orígenes permitidos: local (Live Server / VSCode) y producción (Vercel)
const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://proyecto-five-ivory.vercel.app",
    "https://proyecto-5dh8f0uei-yugrants-projects.vercel.app" // dominio de preview de este deploy
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones sin origin (Postman, curl, health checks de Render)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("No permitido por CORS: " + origin));
        }
    }
}));
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
app.use("/api/procesos", reporteRoutes);

export default app;