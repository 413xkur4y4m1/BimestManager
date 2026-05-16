const express = require('express');

const maestroControlador = require('../controlador/maestroControlador');
const { adminOMaestro } = require('../Middlewares/auth');

const router = express.Router();

const protegerRutaMaestro = adminOMaestro;

router.get('/resumen', protegerRutaMaestro, maestroControlador.obtenerResumen);

router.get('/grupos', protegerRutaMaestro, maestroControlador.listarGrupos);
router.post('/grupos', protegerRutaMaestro, maestroControlador.crearGrupo);
router.get('/grupos/:id/alumnos', protegerRutaMaestro, maestroControlador.listarAlumnosPorGrupo);

router.get('/alumnos', protegerRutaMaestro, maestroControlador.listarAlumnosActivos);
router.get('/materiales', protegerRutaMaestro, maestroControlador.listarMaterialesActivos);
router.get('/equipos', protegerRutaMaestro, maestroControlador.listarTodosLosEquipos);

router.get('/practicas', protegerRutaMaestro, maestroControlador.listarPracticas);

router.get('/sesiones', protegerRutaMaestro, maestroControlador.listarMisSesiones);
router.post('/sesiones', protegerRutaMaestro, maestroControlador.crearSesion);
router.get('/sesiones/:id', protegerRutaMaestro, maestroControlador.obtenerDetalleSesion);
router.patch('/sesiones/:id/estado', protegerRutaMaestro, maestroControlador.cambiarEstadoSesion);
router.get('/sesiones/:id/alumnos', protegerRutaMaestro, maestroControlador.listarAlumnosDeSesion);
router.post('/sesiones/:id/equipos', protegerRutaMaestro, maestroControlador.crearEquipoEnSesion);
router.delete('/equipos/:id', protegerRutaMaestro, maestroControlador.eliminarEquipoDeSesion);

router.get('/sesiones/:id/incidencias', protegerRutaMaestro, maestroControlador.listarIncidenciasDeSesion);
router.post('/sesiones/:id/incidencias', protegerRutaMaestro, maestroControlador.registrarIncidencia);

module.exports = router;
