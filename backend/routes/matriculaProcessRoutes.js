const { procesarMatricula } = require('../services/matriculaServiceP');

async function crearMatricula(req, res) {
  try {
    const resultado = await procesarMatricula(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { crearMatricula };