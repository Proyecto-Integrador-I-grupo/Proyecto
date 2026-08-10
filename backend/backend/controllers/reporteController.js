import { generarReporteResumen, generarReporteDetalle, generarReporteCaso } from "../services/reporteService.js";

export async function obtenerReporteCaso(req, res) {
    try {
        const resultado = await generarReporteCaso(req.query);
        res.status(200).json(resultado);
    } catch (error) {
        console.error(error);
        res.status(400).json({
            mensaje: error.message || "No se pudo generar el reporte solicitado."
        });
    }
}

export async function obtenerReporteResumen(req, res) {
    try {
        const resultado = await generarReporteResumen(req.query);
        res.status(200).json({
            modo: req.query?.modo || "matricula",
            ...resultado
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            mensaje: error.message || "No se pudo generar el reporte de resumen."
        });
    }
}

export async function obtenerReporteDetalle(req, res) {
    try {
        const resultado = await generarReporteDetalle(req.query);
        res.status(200).json({
            modo: req.query?.modo || "matricula",
            detalle: Array.isArray(resultado) ? resultado : []
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            mensaje: error.message || "No se pudo generar el detalle del reporte."
        });
    }
}
