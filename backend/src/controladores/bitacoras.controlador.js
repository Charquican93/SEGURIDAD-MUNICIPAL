const db = require('../config/db');

const obtenerBitacoras = (req, res) => {
  const { id_guardia } = req.query;
  if (!id_guardia) return res.status(400).json({ error: 'Falta id_guardia' });

  db.query('SELECT * FROM bitacoras WHERE id_guardia = ? ORDER BY id_bitacora DESC', [id_guardia], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener bitácoras' });
    const logs = results.map(row => {
      let type = 'NOTIFICACION';
      let description = row.notificaciones;
      if (row.incidencias) { type = 'INCIDENCIA'; description = row.incidencias; }
      else if (row.observaciones) { type = 'OBSERVACION'; description = row.observaciones; }
      
      const dbDate = row.fecha || row.fecha_hora || row.created_at || row.timestamp;
      const dateObj = dbDate ? new Date(dbDate) : new Date();
      return {
        id: `log-${row.id_bitacora}`,
        timestamp: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: dateObj.toLocaleDateString(),
        rawDate: dateObj.toISOString(),
        type,
        description: description || '',
        author: 'Guardia'
      };
    });
    res.json(logs);
  });
};

const crearBitacora = (req, res) => {
  const { rut, tipo, descripcion, foto } = req.body;
  if (!rut || !tipo || !descripcion) return res.status(400).json({ error: 'Faltan datos' });

  db.query('SELECT id_guardia FROM guardias WHERE rut = ?', [rut], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    const id_guardia = results[0].id_guardia;
    let columna = 'notificaciones';
    if (tipo.toUpperCase() === 'OBSERVACION') columna = 'observaciones';
    else if (tipo.toUpperCase() === 'INCIDENCIA') columna = 'incidencias';

    db.query(`INSERT INTO bitacoras (id_guardia, ${columna}, foto) VALUES (?, ?, ?)`, [id_guardia, descripcion, foto || null], (err, result) => {
      if (err) return res.status(500).json({ error: 'Error al guardar' });
      res.json({ success: true, id_bitacora: result.insertId });
    });
  });
};

module.exports = { obtenerBitacoras, crearBitacora };
