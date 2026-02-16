const express = require('express');
const router = express.Router();
const controlador = require('../controladores/dashboard.controlador');

router.get('/dashboard/map-data', controlador.obtenerDatosMapa);
router.get('/dashboard/alerts', controlador.obtenerAlertas);
router.get('/dashboard/events', controlador.obtenerEventos);
router.get('/dashboard/analytics', controlador.obtenerAnaliticas);
router.get('/dashboard/stats', controlador.obtenerEstadisticas);

module.exports = router;