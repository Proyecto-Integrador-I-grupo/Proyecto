import express from "express";
import cors from "cors";

// Importar las rutas
import personaRoutes from "./routes/personaRoutes.js";

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

export default app;