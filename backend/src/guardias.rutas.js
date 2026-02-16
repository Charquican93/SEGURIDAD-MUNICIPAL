const express = require('express');
const router = express.Router();
const controlador = require('../controladores/guardias.controlador');

router.get('/guardias', controlador.obtenerTodos);
router.patch('/guardias/activo', controlador.actualizarEstadoActivo);
router.get('/guardias/estado', controlador.obtenerEstadoGuardia);
router.get('/guardias/:id', controlador.obtenerDetallesGuardia);

module.exports = router;