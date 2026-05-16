const express = require('express');
const monitoreoControlador = require('../controlador/monitoreoControlador');

const router = express.Router();

router.get('/metricas', monitoreoControlador.obtenerMetricas);

module.exports = router;
