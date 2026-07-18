const express = require('express');
const router = express.Router();
const { crearAsistencia } = require('../controllers/asistenciaProcessController');

router.post('/asistencia', crearAsistencia);

module.exports = router;