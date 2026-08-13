import { generarReporteResumen, generarReporteDetalle, generarReporteCaso } from "../services/reporteService.js";

function mensajeError(error, fallback) {
    return error?.message || fallback;
}

export async function obtenerReporteCaso(req, res) {
    try {
        const resultado = await generarReporteCaso(req.query, req.usuarioActual);
        res.status(200).json(resultado);
    } catch (error) {
        console.error("Error generando reporte:", error);
        res.status(400).json({ mensaje: mensajeError(error, "No se pudo generar el reporte solicitado.") });
    }
}

export async function obtenerReporteResumen(req, res) {
    try {
        const resultado = await generarReporteResumen(req.query, req.usuarioActual);
        res.status(200).json(resultado);
    } catch (error) {
        console.error("Error generando resumen:", error);
        res.status(400).json({ mensaje: mensajeError(error, "No se pudo generar el reporte de resumen.") });
    }
}

export async function obtenerReporteDetalle(req, res) {
    try {
        const resultado = await generarReporteDetalle(req.query, req.usuarioActual);
        res.status(200).json({
            modo: resultado?.modo || req.query?.modo || "matricula",
            detalle: Array.isArray(resultado?.detalle) ? resultado.detalle : []
        });
    } catch (error) {
        console.error("Error generando detalle:", error);
        res.status(400).json({ mensaje: mensajeError(error, "No se pudo generar el detalle del reporte.") });
    }
}
