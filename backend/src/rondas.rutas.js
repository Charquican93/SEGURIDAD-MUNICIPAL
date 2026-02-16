const express = require('express');
const router = express.Router();
const controlador = require('../controladores/rondas.controlador');

router.post('/marcajes', controlador.registrarMarcaje);
router.get('/rondas', controlador.obtenerRondas);
router.patch('/rondas/:id', controlador.actualizarEstadoRonda);
router.get('/rondas/:id/puntos', controlador.obtenerPuntosRonda);

module.exports = router;