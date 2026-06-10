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
router.post('/practicas', protegerRutaMaestro, maestroControlador.crearPractica);
router.get('/practicas/:id/kits', protegerRutaMaestro, maestroControlador.listarKitsPorPractica);
router.post('/practicas/:id/kits', protegerRutaMaestro, maestroControlador.crearKit);
router.delete('/kits/:id', protegerRutaMaestro, maestroControlador.eliminarKit);
router.post('/kits/:id/materiales', protegerRutaMaestro, maestroControlador.agregarMaterialAKit);
router.delete('/kits/:kitId/materiales/:materialId', protegerRutaMaestro, maestroControlador.quitarMaterialDeKit);

router.get('/laboratorios', protegerRutaMaestro, maestroControlador.listarLaboratorios);
router.get('/agenda', protegerRutaMaestro, maestroControlador.obtenerAgenda);

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
