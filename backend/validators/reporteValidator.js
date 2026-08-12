import { query } from "express-validator";

const MODOS_VALIDOS = [
    "matricula",
    "estudiantes",
    "grupos",
    "profesores",
    "pre_matricula",
    "auditoria"
];

const TIPOS_VALIDOS = [
    "resumen",
    "detalle",
    "individual",
    "grupo"
];

const ESTADOS_VALIDOS = [
    "presente",
    "ausente",
    "tardia",
    "justificada"
];

const validarRangoFechas = (_, { req }) => {
    const inicio = req.query?.fecha_inicio;
    const fin = req.query?.fecha_fin;

    if (!inicio || !fin) return true;

    if (new Date(inicio) > new Date(fin)) {
        throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    }

    return true;
};

export const reporteRules = [
    query("fecha_inicio")
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage("La fecha de inicio debe tener un formato válido (YYYY-MM-DD)."),

    query("fecha_fin")
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage("La fecha fin debe tener un formato válido (YYYY-MM-DD)."),

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
        .isIn(ESTADOS_VALIDOS)
        .withMessage("El estado de asistencia no es válido."),

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

    query().custom(validarRangoFechas)
];
