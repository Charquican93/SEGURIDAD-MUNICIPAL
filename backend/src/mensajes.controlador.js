const db = require('../config/db');

const enviarDifusion = async (req, res) => {
  const { titulo, contenido, emisor } = req.body;
  
  if (!contenido) {
    return res.status(400).json({ error: 'Falta el contenido del mensaje' });
  }

  const tituloFinal = titulo || 'ANUNCIO GENERAL';
  const sender = emisor || 'SUPERVISOR';

  try {
    const [guardias] = await db.promise().query('SELECT id_guardia FROM guardias WHERE activo = 1');
    
    if (guardias.length === 0) {
      return res.status(404).json({ error: 'No hay guardias activos para recibir el mensaje.' });
    }

    const queries = guardias.map(g => {
      return db.promise().query(
        'INSERT INTO mensajes (id_guardia, titulo, contenido, emisor) VALUES (?, ?, ?, ?)',
        [g.id_guardia, tituloFinal, contenido, sender]
      );
    });

    await Promise.all(queries);
    res.json({ success: true, count: guardias.length, message: `Mensaje enviado a ${guardias.length} guardias activos.` });

  } catch (err) {
    console.error('Error en broadcast:', err);
    res.status(500).json({ error: 'Error al enviar difusión' });
  }
};

const enviarMensaje = (req, res) => {
  const { id_guardia, titulo, contenido, emisor } = req.body;
  const tituloFinal = titulo || 'Mensaje';

  if (!id_guardia || !contenido) {
    return res.status(400).json({ error: 'Faltan datos del mensaje' });
  }
  
  const sender = emisor || 'SUPERVISOR';
  const query = 'INSERT INTO mensajes (id_guardia, titulo, contenido, emisor) VALUES (?, ?, ?, ?)';
  
  db.query(query, [id_guardia, tituloFinal, contenido, sender], (err, result) => {
    if (err) {
      console.error('Error al enviar mensaje:', err);
      return res.status(500).json({ error: 'Error al enviar mensaje' });
    }
    res.json({ success: true, id_mensaje: result.insertId });
  });
};

const obtenerMensajes = (req, res) => {
  const { id_guardia } = req.query;
  
  if (id_guardia) {
    const query = 'SELECT * FROM mensajes WHERE id_guardia = ? ORDER BY fecha_hora DESC LIMIT 50';
    db.query(query, [id_guardia], (err, results) => {
      if (err) return res.status(500).json({ error: 'Error al obtener mensajes' });
      res.json(results);
    });
  } else {
    const query = `
      SELECT m.*, g.nombre, g.apellido 
      FROM mensajes m
      JOIN guardias g ON m.id_guardia = g.id_guardia
      ORDER BY m.fecha_hora DESC LIMIT 500
    `;
    db.query(query, (err, results) => {
      if (err) return res.status(500).json({ error: 'Error al obtener mensajes' });
      res.json(results);
    });
  }
};

const actualizarMensaje = (req, res) => {
  const { id } = req.params;
  const { leido } = req.body;

  const leidoValue = leido !== undefined ? leido : 1; 

  db.query('UPDATE mensajes SET leido = ? WHERE id_mensaje = ?', [leidoValue, id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar mensaje' });
    res.json({ success: true });
  });
};

module.exports = {
  enviarDifusion,
  enviarMensaje,
  obtenerMensajes,
  actualizarMensaje
};