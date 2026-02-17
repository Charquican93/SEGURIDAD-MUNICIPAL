const express = require('express');
const router = express.Router();
const controlador = require('../controladores/mensajes.controlador');

router.post('/mensajes/broadcast', controlador.enviarDifusion);
router.post('/mensajes', controlador.enviarMensaje);
router.get('/mensajes', controlador.obtenerMensajes);
router.patch('/mensajes/:id/leido', controlador.actualizarMensaje);
router.patch('/mensajes/:id', controlador.actualizarMensaje);
router.put('/mensajes/:id', controlador.actualizarMensaje);

module.exports = router;
