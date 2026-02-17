const db = require('../config/db');

const obtenerPuestos = (req, res) => {
  db.query('SELECT * FROM puestos', (err, results) => {
    if (err) return res.status(500).json({ error: 'Error puestos' });
    res.json(results);
  });
};

const iniciarTurno = (req, res) => {
  const { id_guardia, id_puesto } = req.body;
  if (!id_guardia || !id_puesto) return res.status(400).json({ error: 'Faltan datos' });
  db.query('INSERT INTO turnos (id_guardia, id_puesto, fecha, hora_inicio) VALUES (?, ?, CURDATE(), CURTIME())', [id_guardia, id_puesto], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error iniciar turno' });
    db.query('UPDATE guardias SET activo = 1 WHERE id_guardia = ?', [id_guardia]);
    res.json({ success: true, id_turno: result.insertId });
  });
};

const finalizarTurno = (req, res) => {
  const { id } = req.params;
  db.query('UPDATE turnos SET hora_fin = CURTIME() WHERE id_turno = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error finalizar turno' });
    res.json({ success: true });
  });
};

const crearCheck = (req, res) => {
  const { id_guardia, id_puesto, latitud, longitud } = req.body;
  if (!id_guardia || !id_puesto) return res.status(400).json({ error: 'Faltan datos' });
  db.query('INSERT INTO checks_presencia (id_guardia, id_puesto, latitud, longitud) VALUES (?, ?, ?, ?)', [id_guardia, id_puesto, latitud, longitud], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error check' });
    res.json({ success: true, id_presencia: result.insertId });
  });
};

const obtenerChecks = (req, res) => {
  const { id_guardia, search } = req.query;
  let query = `SELECT cp.*, p.puesto, g.nombre, g.apellido FROM checks_presencia cp LEFT JOIN puestos p ON cp.id_puesto = p.id_puesto JOIN guardias g ON cp.id_guardia = g.id_guardia`;
  const params = [];
  const conditions = [];
  if (id_guardia) { conditions.push('cp.id_guardia = ?'); params.push(id_guardia); }
  if (search) { conditions.push('CONCAT(g.nombre, " ", g.apellido) LIKE ?'); params.push(`%${search}%`); }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY cp.fecha_hora DESC LIMIT 50';
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error obtener checks' });
    res.json(results);
  });
};

const crearAlertaPanico = async (req, res) => {
  try {
    const { id_guardia, id_puesto, latitud, longitud } = req.body;
    if (!id_guardia || typeof latitud === 'undefined' || typeof longitud === 'undefined') return res.status(400).json({ error: 'Faltan datos' });
    const [result] = await db.promise().query('INSERT INTO alertas_panico (id_guardia, id_puesto, latitud, longitud) VALUES (?, ?, ?, ?)', [id_guardia, id_puesto || null, latitud, longitud]);
    res.status(201).json({ success: true, id_alerta: result.insertId, message: 'Alerta registrada.' });
  } catch (err) { res.status(500).json({ error: 'Error pánico' }); }
};

module.exports = { obtenerPuestos, iniciarTurno, finalizarTurno, crearCheck, obtenerChecks, crearAlertaPanico };
