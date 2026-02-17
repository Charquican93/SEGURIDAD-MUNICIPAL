const express = require('express');
const router = express.Router();
const controlador = require('../controladores/autenticacion.controlador'); // Ajustado path

router.post('/login', controlador.login);

module.exports = router;
