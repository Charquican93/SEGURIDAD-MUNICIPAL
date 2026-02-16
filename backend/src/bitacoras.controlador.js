const db = require('../config/db');

const obtenerBitacoras = (req, res) => {
  const { id_guardia } = req.query;
  if (!id_guardia) {
    return res.status(400).json({ error: 'Falta id_guardia' });
  }

  const query = 'SELECT * FROM bitacoras WHERE id_guardia = ? ORDER BY id_bitacora DESC';
  
  db.query(query, [id_guardia], (err, results) => {
    if (err) {
      console.error('Error al obtener bitácoras:', err);
      return res.status(500).json({ error: 'Error al obtener bitácoras' });
    }

    const logs = results.map(row => {
      let type = 'NOTIFICACION';
      let description = '';
      
      if (row.incidencias) {
        type = 'INCIDENCIA';
        description = row.incidencias;
      } else if (row.observaciones) {
        type = 'OBSERVACION';
        description = row.observaciones;
      } else {
        description = row.notificaciones;
      }

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

  if (!rut || !tipo || !descripcion) {
    return res.status(400).json({ error: 'Faltan datos para la bitácora' });
  }

  db.query('SELECT id_guardia FROM guardias WHERE rut = ?', [rut], (err, results) => {
    if (err) {
      console.error('Error al buscar guardia:', err);
      return res.status(500).json({ error: 'Error al buscar guardia' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });

    const id_guardia = results[0].id_guardia;
    const tipoNormalizado = tipo.toUpperCase();
    let columna = 'notificaciones';
    if (tipoNormalizado === 'OBSERVACION') columna = 'observaciones';
    else if (tipoNormalizado === 'INCIDENCIA') columna = 'incidencias';

    const query = `INSERT INTO bitacoras (id_guardia, ${columna}, foto) VALUES (?, ?, ?)`;
    
    db.query(query, [id_guardia, descripcion, foto || null], (err, result) => {
      if (err) {
        console.error(`Error MySQL al guardar en columna '${columna}':`, err.message);
        return res.status(500).json({ error: 'Error al guardar en bitácora' });
      }
      res.json({ success: true, id_bitacora: result.insertId });
    });
  });
};

module.exports = { obtenerBitacoras, crearBitacora };