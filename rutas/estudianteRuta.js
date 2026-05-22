const express = require('express');

const estudianteControlador = require('../controlador/estudianteControlador');
const { soloAlumno, adminOMaestro } = require('../Middlewares/auth');

const router = express.Router();

router.get('/mi-panel', soloAlumno, estudianteControlador.obtenerMiPanel);
router.post('/firmar', soloAlumno, estudianteControlador.firmarResponsiva);

router.get('/pendientes', adminOMaestro, estudianteControlador.listarPendientes);
router.patch('/:id/grupo', adminOMaestro, estudianteControlador.asignarGrupo);
router.patch('/:id/activar', adminOMaestro, estudianteControlador.activarEstudiante);

module.exports = router;
