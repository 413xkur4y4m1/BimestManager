const express = require('express');

const estudianteTurismControlador = require('../controlador/estudianteTurismControlador');
const { soloAlumnoTurismo, soloAdminTurismo } = require('../Middlewares/auth');

const router = express.Router();

router.get('/mi-panel', soloAlumnoTurismo, estudianteTurismControlador.obtenerMiPanel);

router.get('/mis-prestamos', soloAlumnoTurismo, estudianteTurismControlador.listarMisPrestamos);
router.get('/mis-adeudos', soloAlumnoTurismo, estudianteTurismControlador.listarMisAdeudos);

router.get('/mis-notificaciones', soloAlumnoTurismo, estudianteTurismControlador.listarMisNotificaciones);
router.patch(
  '/notificaciones/:id/leer',
  soloAlumnoTurismo,
  estudianteTurismControlador.marcarNotificacionLeida
);

router.get('/sesion-activa', soloAlumnoTurismo, estudianteTurismControlador.obtenerSesionActiva);
router.get('/mis-sesiones', soloAlumnoTurismo, estudianteTurismControlador.listarMisSesiones);

router.get(
  '/materiales-disponibles',
  soloAlumnoTurismo,
  estudianteTurismControlador.listarMaterialesDisponibles
);
router.get(
  '/practicas/:practicaId/sugerencias',
  soloAlumnoTurismo,
  estudianteTurismControlador.listarSugerenciasPractica
);

router.post('/prestamos', soloAlumnoTurismo, estudianteTurismControlador.solicitarPrestamo);
router.post(
  '/prestamos/:id/incidencia',
  soloAlumnoTurismo,
  estudianteTurismControlador.reportarIncidencia
);

router.get('/pendientes', soloAdminTurismo, estudianteTurismControlador.listarPendientes);
router.patch('/:id/grupo', soloAdminTurismo, estudianteTurismControlador.asignarGrupo);
router.patch('/:id/activar', soloAdminTurismo, estudianteTurismControlador.activarEstudiante);

module.exports = router;
