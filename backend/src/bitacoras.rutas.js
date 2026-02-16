const express = require('express');
const router = express.Router();
const controlador = require('../controladores/bitacoras.controlador');

router.get('/bitacoras', controlador.obtenerBitacoras);
router.post('/bitacoras', controlador.crearBitacora);

module.exports = router;