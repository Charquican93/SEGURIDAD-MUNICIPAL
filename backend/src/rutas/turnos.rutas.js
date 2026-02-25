const express = require('express');
const router = express.Router();
const turnosCtrl = require('../controladores/turnos.controlador');

// Ruta para obtener historial (GET)
router.get('/turnos', turnosCtrl.obtenerTurnos);

// Ruta para iniciar turno (POST)
router.post('/turnos', turnosCtrl.iniciarTurno);

// Ruta para terminar turno (PATCH)
router.patch('/turnos/:id', turnosCtrl.terminarTurno);

module.exports = router;
