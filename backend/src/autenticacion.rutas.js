const express = require('express');
const router = express.Router();
const controlador = require('../controladores/autenticacion.controlador');

router.post('/login', controlador.login);

module.exports = router;