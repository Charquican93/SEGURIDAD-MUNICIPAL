const express = require('express');
const router = express.Router();
const controlador = require('../controladores/rondas.controlador');

router.post('/marcajes', controlador.registrarMarcaje);
router.get('/rondas', controlador.obtenerRondas);
router.post('/rondas', controlador.crearRonda);
router.patch('/rondas/:id', controlador.actualizarEstadoRonda);
router.delete('/rondas/:id', controlador.eliminarRonda);
router.get('/rondas/:id/puntos', controlador.obtenerPuntosRonda);
router.put('/rondas/:id', controlador.editarRonda);

module.exports = router;
