const express = require('express');
const router = express.Router();
const controlador = require('../controladores/operaciones.controlador');

router.get('/puestos', controlador.obtenerPuestos);
router.post('/turnos', controlador.iniciarTurno);
router.patch('/turnos/:id', controlador.finalizarTurno);
router.post('/checks', controlador.crearCheck);
router.get('/checks', controlador.obtenerChecks);
router.post('/panic', controlador.crearAlertaPanico);

module.exports = router;