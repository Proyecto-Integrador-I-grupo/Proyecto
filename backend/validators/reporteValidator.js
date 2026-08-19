import { query } from "express-validator";

const MODOS_VALIDOS = ["matricula", "estudiantes", "grupos", "profesores", "pre_matricula", "auditoria", "pagos"];
const TIPOS_VALIDOS = ["resumen", "detalle", "individual", "grupo"];
const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];
const ESTADOS_PAGO_VALIDOS = ["pendiente", "cancelado"];

const validarRangoFechas = (_, { req }) => {
    const inicio = req.query?.fecha_inicio;
    const fin = req.query?.fecha_fin;
    if (!inicio || !fin) return true;
    if (inicio > fin) throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    return true;
};

const validarEstadoReporte = (value, { req }) => {
    if (!value) return true;

    const estado = String(value).trim().toLowerCase();
    const modo = String(req.query?.modo || "").trim().toLowerCase();
    const validos = modo === "pagos" ? ESTADOS_PAGO_VALIDOS : ESTADOS_VALIDOS;

    if (!validos.includes(estado)) {
        throw new Error(modo === "pagos"
            ? "El estado de pago no es válido. Usa pendiente o cancelado."
            : "El estado de asistencia no es válido.");
    }

    return true;
};

export const reporteRules = [
    query("fecha_inicio")
        .optional({ nullable: true, checkFalsy: true })
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("La fecha de inicio debe tener el formato YYYY-MM-DD."),
    query("fecha_fin")
        .optional({ nullable: true, checkFalsy: true })
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("La fecha fin debe tener el formato YYYY-MM-DD."),
    query("id_grupo")
        .optional({ nullable: true, checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage("El grupo debe ser un identificador válido."),
    query("id_estudiante")
        .optional({ nullable: true, checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage("El estudiante debe ser un identificador válido."),
    query("estado_asistencia")
        .optional({ nullable: true, checkFalsy: true })
        .custom(validarEstadoReporte)
        .withMessage("El estado del reporte no es válido."),
    query("estado_pago")
        .optional({ nullable: true, checkFalsy: true })
        .custom(validarEstadoReporte)
        .withMessage("El estado del pago no es válido."),
    query("busqueda")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .trim()
        .isLength({ min: 1, max: 120 })
        .withMessage("La búsqueda debe contener entre 1 y 120 caracteres."),
    query("tipo_reporte")
        .optional({ nullable: true, checkFalsy: true })
        .isIn(TIPOS_VALIDOS)
        .withMessage("El tipo de reporte no es válido."),
    query("modo")
        .optional({ nullable: true, checkFalsy: true })
        .isIn(MODOS_VALIDOS)
        .withMessage("El modo de reporte no es válido."),
    query("fecha_fin").optional({ nullable: true, checkFalsy: true }).custom(validarRangoFechas)
];
