import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import personaRoutes from "./routes/personaRoutes.js";
import profesorRoutes from "./routes/profesorRoutes.js";
import estudianteRoutes from "./routes/estudianteRoutes.js";
import matriculaProcessRoutes from "./routes/matriculaProcessRoutes.js";
import asistenciaProcessRoutes from "./routes/asistenciaProcessRoutes.js";
import seccionRoutes from "./routes/seccionRoutes.js";
import reporteRoutes from "./routes/reporteRoutes.js";
import auditoriaRoutes from "./routes/auditoriaRoutes.js";
import finanzaRoutes from "./routes/finanzaRoutes.js";

import { identificarUsuario } from "./middleware/authMiddleware.js";

const app = express();

const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5500",
  "https://proyecto-five-ivory.vercel.app",
  ...configuredOrigins,
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".vercel.app") &&
      (
        url.hostname === "proyecto-five-ivory.vercel.app" ||
        url.hostname.startsWith("proyecto-five-ivory-") ||
        url.hostname.startsWith("proyecto-")
      )
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origen rechazado: ${origin}`);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Id",
    "X-Requested-With",
  ],
  exposedHeaders: ["Content-Disposition", "Content-Type"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(identificarUsuario);

app.get("/", (req, res) => {
  res.json({
    mensaje: "Bienvenido a la API del Sistema Escolar",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", servicio: "EduControl API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/personas", personaRoutes);
app.use("/api/profesores", profesorRoutes);
app.use("/api/estudiantes", estudianteRoutes);
app.use("/api/procesos/secciones", seccionRoutes);
app.use("/api/procesos", matriculaProcessRoutes);
app.use("/api/procesos", asistenciaProcessRoutes);
app.use("/api/procesos", reporteRoutes);
app.use("/api/auditorias", auditoriaRoutes);
app.use("/api/finanzas", finanzaRoutes);

app.use((err, req, res, next) => {
  if (err?.message?.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }
  return next(err);
});

export default app;
