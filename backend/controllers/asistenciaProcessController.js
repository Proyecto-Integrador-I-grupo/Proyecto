const { registrarAsistenciaProceso } = require('../services/asistenciaServiceP');

async function crearAsistencia(req, res) {
  try {
    const resultado = await registrarAsistenciaProceso(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { crearAsistencia };