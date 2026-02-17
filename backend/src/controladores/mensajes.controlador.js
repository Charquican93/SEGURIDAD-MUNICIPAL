const db = require('../config/db');

const enviarDifusion = async (req, res) => {
  const { titulo, contenido, emisor } = req.body;
  if (!contenido) return res.status(400).json({ error: 'Falta contenido' });

  try {
    const [guardias] = await db.promise().query('SELECT id_guardia FROM guardias WHERE activo = 1');
    if (guardias.length === 0) return res.status(404).json({ error: 'No hay guardias activos' });

    const queries = guardias.map(g => db.promise().query('INSERT INTO mensajes (id_guardia, titulo, contenido, emisor) VALUES (?, ?, ?, ?)', [g.id_guardia, titulo || 'ANUNCIO GENERAL', contenido, emisor || 'SUPERVISOR']));
    await Promise.all(queries);
    res.json({ success: true, count: guardias.length, message: `Enviado a ${guardias.length} guardias.` });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar difusión' });
  }
};

const enviarMensaje = (req, res) => {
  const { id_guardia, titulo, contenido, emisor } = req.body;
  if (!id_guardia || !contenido) return res.status(400).json({ error: 'Faltan datos' });
  
  db.query('INSERT INTO mensajes (id_guardia, titulo, contenido, emisor) VALUES (?, ?, ?, ?)', [id_guardia, titulo || 'Mensaje', contenido, emisor || 'SUPERVISOR'], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al enviar' });
    res.json({ success: true, id_mensaje: result.insertId });
  });
};

const obtenerMensajes = (req, res) => {
  const { id_guardia } = req.query;
  if (id_guardia) {
    db.query('SELECT * FROM mensajes WHERE id_guardia = ? ORDER BY fecha_hora DESC LIMIT 50', [id_guardia], (err, results) => {
      if (err) return res.status(500).json({ error: 'Error al obtener mensajes' });
      res.json(results);
    });
  } else {
    db.query('SELECT m.*, g.nombre, g.apellido FROM mensajes m JOIN guardias g ON m.id_guardia = g.id_guardia ORDER BY m.fecha_hora DESC LIMIT 500', (err, results) => {
      if (err) return res.status(500).json({ error: 'Error al obtener mensajes' });
      res.json(results);
    });
  }
};

const actualizarMensaje = (req, res) => {
  const { id } = req.params;
  const { leido } = req.body;
  db.query('UPDATE mensajes SET leido = ? WHERE id_mensaje = ?', [leido !== undefined ? leido : 1, id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar' });
    res.json({ success: true });
  });
};

module.exports = { enviarDifusion, enviarMensaje, obtenerMensajes, actualizarMensaje };
