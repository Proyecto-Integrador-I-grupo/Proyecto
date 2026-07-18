import express from "express";
import cors from "cors";

// Importar las rutas
import personaRoutes from "./routes/personaRoutes.js";
import matriculaProcessRoutes from "./routes/matriculaProcessRoutes.js";
import asistenciaProcessRoutes from "./routes/asistenciaProcessRoutes.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
    res.json({
        mensaje: "Bienvenido a la API del Sistema Escolar"
    });
});

// Rutas del módulo Persona
app.use("/api/personas", personaRoutes);
app.use("/api/procesos", matriculaProcessRoutes);
app.use("/api/procesos", asistenciaProcessRoutes);

export default app;