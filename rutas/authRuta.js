const express = require('express');

const authControlador = require('../controlador/authControlador');
const { autenticar, cargarUsuarioActual } = require('../Middlewares/auth');

const router = express.Router();

router.post('/registro-alumno', authControlador.registrarAlumno);
router.post('/registro-alumno-turismo', authControlador.registrarAlumnoTurismo);
router.post('/login', authControlador.login);
router.post('/logout', authControlador.logout);
router.get('/yo', autenticar, cargarUsuarioActual, authControlador.yo);

module.exports = router;
