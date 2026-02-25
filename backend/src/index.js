const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');

// IMPORTANTE: Los middleware deben ir ANTES de las rutas para que req.body funcione
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Importar conexión a Base de Datos
const db = require('./config/db');

// Importar Rutas
const rutasAutenticacion = require('./rutas/autenticacion.rutas');
const rutasGuardias = require('./rutas/guardias.rutas');
const rutasRondas = require('./rutas/rondas.rutas');
const rutasBitacoras = require('./rutas/bitacoras.rutas');
const rutasMensajes = require('./rutas/mensajes.rutas');
const rutasDashboard = require('./rutas/dashboard.rutas');
const rutasOperaciones = require('./rutas/operaciones.rutas');
const rutasTurnos = require('./rutas/turnos.rutas');

app.use(rutasAutenticacion);
app.use(rutasGuardias);
app.use(rutasRondas);
app.use(rutasBitacoras);
app.use(rutasMensajes);
app.use(rutasDashboard);
app.use(rutasOperaciones);
app.use(rutasTurnos);

app.get('/', (req, res) => {
  res.send('API funcionando');
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor backend escuchando en puerto ${port} en TODAS las interfaces`);
});
