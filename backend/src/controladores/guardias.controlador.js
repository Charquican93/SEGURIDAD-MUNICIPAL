const db = require('../config/db');

const obtenerTodos = (req, res) => {
  db.query('SELECT id_guardia, nombre, apellido, rut, activo FROM guardias', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener guardias' });
    }
    res.json(results);
  });
};

const actualizarEstadoActivo = (req, res) => {
  const { rut, activo } = req.body;
  if (!rut || typeof activo === 'undefined') return res.status(400).json({ error: 'Faltan datos' });

  db.query('UPDATE guardias SET activo = ? WHERE rut = ?', [activo, rut], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar estado' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    res.json({ success: true });
  });
};

const obtenerEstadoGuardia = (req, res) => {
  const { rut } = req.query;
  if (!rut) return res.status(400).json({ error: 'Falta el RUT' });
  
  db.query('SELECT id_guardia, activo FROM guardias WHERE rut = ?', [rut], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener estado' });
    if (results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    
    const guardia = results[0];
    if (guardia.activo) {
      db.query(
        'SELECT id_turno FROM turnos WHERE id_guardia = ? AND hora_fin IS NULL ORDER BY id_turno DESC LIMIT 1',
        [guardia.id_guardia],
        (errTurno, resTurno) => {
          const id_turno = resTurno.length > 0 ? resTurno[0].id_turno : null;
          res.json({ activo: 1, id_turno });
        }
      );
    } else {
      res.json({ activo: 0, id_turno: null });
    }
  });
};

const obtenerDetallesGuardia = (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM guardias WHERE id_guardia = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener detalles' });
    if (results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    const guardia = results[0];
    delete guardia.contrasena;
    res.json(guardia);
  });
};

module.exports = { obtenerTodos, actualizarEstadoActivo, obtenerEstadoGuardia, obtenerDetallesGuardia };
