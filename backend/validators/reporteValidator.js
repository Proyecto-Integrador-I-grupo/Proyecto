import { query } from "express-validator";

const validarRangoFechas = (fechaInicio, { req }) => {
    const inicio = req.query?.fecha_inicio;
    const fin = req.query?.fecha_fin;

    if (!inicio || !fin) {
        return true;
    }

    if (new Date(inicio) > new Date(fin)) {
        throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    }

    return true;
};

const validarBusquedaReporte = (valor, { req }) => {
    const busqueda = String(req.query?.busqueda || "").trim();

    if (!busqueda) {
        return true;
    }

    if (busqueda.length > 120) {
        throw new Error("La búsqueda no puede superar 120 caracteres.");
    }

    if (!/^[a-zA-ZÀ-ÿ0-9\s._-]+$/.test(busqueda)) {
        throw new Error("La búsqueda solo puede contener letras, números, espacios, puntos, guiones y guiones bajos.");
    }

    return true;
};

export const reporteRules = [
    query("fecha_inicio")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("La fecha de inicio debe tener un formato válido (YYYY-MM-DD)."),
    query("fecha_fin")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("La fecha fin debe tener un formato válido (YYYY-MM-DD)."),
    query("id_grupo")
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage("El grupo debe ser un identificador válido."),
    query("id_estudiante")
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage("El estudiante debe ser un identificador válido."),
    query("estado_asistencia")
        .optional({ nullable: true })
        .isIn(["presente", "ausente", "tardia", "justificada"])
        .withMessage("El estado de asistencia debe ser presente, ausente, tardia o justificada."),
    query("busqueda")
        .optional({ nullable: true })
        .isString()
        .trim()
        .isLength({ min: 1, max: 120 })
        .withMessage("La búsqueda debe contener entre 1 y 120 caracteres."),
    query().custom(validarBusquedaReporte),
    query("tipo_reporte")
        .optional({ nullable: true })
        .isIn(["resumen", "detalle", "individual", "grupo"])
        .withMessage("El tipo de reporte debe ser resumen, detalle, individual o grupo."),
    query("modo")
        .optional({ nullable: true })
        .isIn(["matricula", "estudiantes", "grupos", "profesores"])
        .withMessage("El modo de reporte debe ser matricula, estudiantes, grupos o profesores."),
    query().custom(validarRangoFechas)
];
