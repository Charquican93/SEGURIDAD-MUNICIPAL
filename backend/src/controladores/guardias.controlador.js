const db = require('../config/db');

const obtenerTodos = async (req, res) => {
  try {
    const [results] = await db.promise().query('SELECT id_guardia, nombre, apellido, rut, activo FROM guardias');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener guardias' });
  }
};

const actualizarEstadoActivo = async (req, res) => {
  const { rut, activo } = req.body;
  if (!rut || typeof activo === 'undefined') return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [result] = await db.promise().query('UPDATE guardias SET activo = ? WHERE rut = ?', [activo, rut]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

const obtenerEstadoGuardia = async (req, res) => {
  const { rut } = req.query;
  if (!rut) return res.status(400).json({ error: 'Falta el RUT' });
  
  try {
    const [results] = await db.promise().query('SELECT id_guardia, activo FROM guardias WHERE rut = ?', [rut]);
    if (results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    
    const guardia = results[0];
    let id_turno = null;

    if (guardia.activo) {
      const [resTurno] = await db.promise().query(
        'SELECT id_turno FROM turnos WHERE id_guardia = ? AND hora_fin IS NULL ORDER BY id_turno DESC LIMIT 1', 
        [guardia.id_guardia]
      );
      if (resTurno.length > 0) id_turno = resTurno[0].id_turno;
    }
    
    res.json({ activo: guardia.activo, id_turno });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estado' });
  }
};

const obtenerDetallesGuardia = async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.promise().query('SELECT * FROM guardias WHERE id_guardia = ?', [id]);
    if (results.length === 0) return res.status(404).json({ error: 'Guardia no encontrado' });
    const guardia = results[0];
    delete guardia.contrasena;
    res.json(guardia);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener detalles' });
  }
};

module.exports = { obtenerTodos, actualizarEstadoActivo, obtenerEstadoGuardia, obtenerDetallesGuardia };
