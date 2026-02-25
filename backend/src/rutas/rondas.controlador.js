const db = require('../config/db');

// Obtener rondas (Soporta filtros por fecha, guardia, periodo y puesto)
const obtenerRondas = async (req, res) => {
  const { id_guardia, fecha, periodo, id_puesto } = req.query;
  
  try {
    let query = `
      SELECT r.*, 
             g.nombre as nombre_guardia, g.apellido as apellido_guardia,
             p.puesto as nombre_ruta, p.instalaciones
      FROM rondas r
      LEFT JOIN guardias g ON r.id_guardia = g.id_guardia
      LEFT JOIN puestos p ON r.id_ruta = p.id_puesto
      WHERE 1=1
    `;
    
    const params = [];

    if (id_guardia) {
      query += ' AND r.id_guardia = ?';
      params.push(id_guardia);
    }

    if (id_puesto) {
      query += ' AND r.id_ruta = ?';
      params.push(id_puesto);
    }

    // Filtro por fecha específica (para el planificador)
    if (fecha) {
      query += ' AND r.fecha = ?';
      params.push(fecha);
    }

    // Filtros de periodo (para el dashboard/app)
    if (periodo === 'hoy') {
      query += ' AND r.fecha = CURDATE()';
    } else if (periodo === 'semana') {
      query += ' AND YEARWEEK(r.fecha, 1) = YEARWEEK(CURDATE(), 1)';
    } else if (periodo === 'mes') {
      query += ' AND MONTH(r.fecha) = MONTH(CURDATE()) AND YEAR(r.fecha) = YEAR(CURDATE())';
    }

    query += ' ORDER BY r.fecha DESC, r.hora ASC';

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener rondas:', error);
    res.status(500).json({ error: 'Error al obtener las rondas' });
  }
};

// Crear una nueva ronda (Programación manual)
const crearRonda = async (req, res) => {
  const { id_guardia, id_ruta, fecha, hora, estado } = req.body;

  if (!id_guardia || !id_ruta || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (guardia, ruta/puesto, fecha, hora)' });
  }

  try {
    const [result] = await db.promise().query(
      'INSERT INTO rondas (id_guardia, id_ruta, fecha, hora, estado) VALUES (?, ?, ?, ?, ?)',
      [id_guardia, id_ruta, fecha, hora, estado || 'PROGRAMADA']
    );

    res.json({ 
      message: 'Ronda programada exitosamente', 
      id_ronda: result.insertId 
    });
  } catch (error) {
    console.error('Error al crear ronda:', error);
    res.status(500).json({ error: 'Error al programar la ronda' });
  }
};

// Eliminar una ronda
const eliminarRonda = async (req, res) => {
  const { id } = req.params;

  try {
    await db.promise().query('DELETE FROM rondas WHERE id_ronda = ?', [id]);
    res.json({ message: 'Ronda eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar ronda:', error);
    res.status(500).json({ error: 'Error al eliminar la ronda' });
  }
};

// Obtener puntos de una ronda específica
const obtenerPuntosRonda = async (req, res) => {
  const { id } = req.params;
  try {
    // Obtenemos los marcajes realizados
    const [rows] = await db.promise().query(`
      SELECT m.*, 'Punto Control' as nombre 
      FROM marcajes m 
      WHERE m.id_ronda = ?
      ORDER BY m.fecha_hora ASC
    `, [id]);
    
    const puntos = rows.map(p => ({
      ...p,
      marcado: true,
      hora_marcaje: p.fecha_hora,
      nombre: p.id_punto // O el nombre real si existe tabla de puntos
    }));

    res.json(puntos);
  } catch (error) {
    console.error('Error al obtener puntos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = {
  obtenerRondas,
  crearRonda,
  eliminarRonda,
  obtenerPuntosRonda
};