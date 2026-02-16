const db = require('../config/db');

const obtenerDatosMapa = async (req, res) => {
  try {
    const query = `
      SELECT 
        g.id_guardia, 
        g.nombre, 
        g.apellido, 
        cp.latitud, 
        cp.longitud, 
        cp.fecha_hora,
        (SELECT COUNT(*) FROM rondas r WHERE r.id_guardia = g.id_guardia AND DATE(r.fecha) = CURDATE()) as total_rondas,
        (SELECT COUNT(*) FROM rondas r WHERE r.id_guardia = g.id_guardia AND DATE(r.fecha) = CURDATE() AND r.estado = 'COMPLETADA') as rondas_completadas
      FROM guardias g
      JOIN (
          SELECT id_guardia, MAX(id_presencia) as last_id
          FROM checks_presencia
          GROUP BY id_guardia
      ) latest ON g.id_guardia = latest.id_guardia
      JOIN checks_presencia cp ON latest.last_id = cp.id_presencia
      WHERE g.activo = 1
    `;
    const [guards] = await db.promise().query(query);
    res.json(guards);
  } catch (err) {
    console.error('Error en /dashboard/map-data:', err);
    res.status(500).json({ error: 'Error al obtener datos del mapa' });
  }
};

const obtenerAlertas = async (req, res) => {
  try {
    const [alerts] = await db.promise().query(`
      SELECT 'PÁNICO' as tipo, a.fecha_hora, a.latitud, a.longitud, g.nombre, g.apellido, 'Alerta de Pánico activada' as descripcion 
      FROM alertas_panico a 
      JOIN guardias g ON a.id_guardia = g.id_guardia
      ORDER BY a.fecha_hora DESC
      LIMIT 10
    `);
    res.json(alerts);
  } catch (err) {
    console.error('Error en /dashboard/alerts:', err);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
};

const obtenerEventos = (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT b.*, g.nombre, g.apellido 
    FROM bitacoras b 
    JOIN guardias g ON b.id_guardia = g.id_guardia 
  `;
  const params = [];

  if (search) {
    query += ' WHERE CONCAT(g.nombre, " ", g.apellido) LIKE ? ';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY b.id_bitacora DESC LIMIT 50';
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error al obtener eventos:', err);
      return res.status(500).json({ error: 'Error al obtener eventos' });
    }

    const events = results.map(row => {
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
        id: row.id_bitacora,
        timestamp: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: dateObj.toLocaleDateString(),
        type,
        description: description || '',
        author: `${row.nombre} ${row.apellido}`,
        photo: row.foto
      };
    });
    res.json(events);
  });
};

const obtenerAnaliticas = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let roundsQuery = `
      SELECT DATE_FORMAT(fecha, '%d/%m') as date, COUNT(*) as total, SUM(CASE WHEN estado = 'COMPLETADA' THEN 1 ELSE 0 END) as completed
      FROM rondas
      WHERE 1=1
    `;
    let roundsParams = [];

    let eventsQuery = `
      SELECT 
        CASE 
          WHEN incidencias IS NOT NULL AND incidencias != '' THEN 'Incidencia'
          WHEN observaciones IS NOT NULL AND observaciones != '' THEN 'Observación'
          ELSE 'Notificación'
        END as name,
        COUNT(*) as value
      FROM bitacoras
      WHERE 1=1
    `;
    let eventsParams = [];

    let topGuardsQuery = `
      SELECT CONCAT(g.nombre, ' ', LEFT(g.apellido, 1), '.') as name, COUNT(r.id_ronda) as rondas
      FROM guardias g
      JOIN rondas r ON g.id_guardia = r.id_guardia
      WHERE r.estado = 'COMPLETADA'
    `;
    let topGuardsParams = [];

    if (startDate && endDate) {
      roundsQuery += ' AND fecha BETWEEN ? AND ?';
      roundsParams.push(startDate, endDate);
      eventsQuery += ' AND (fecha BETWEEN ? AND ?)';
      eventsParams.push(startDate, endDate);
      topGuardsQuery += ' AND r.fecha BETWEEN ? AND ?';
      topGuardsParams.push(startDate, endDate);
    } else {
      roundsQuery += ' AND fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)';
      eventsQuery += ' AND (fecha IS NULL OR fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))';
      topGuardsQuery += ' AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    roundsQuery += ' GROUP BY fecha ORDER BY fecha ASC';
    eventsQuery += ' GROUP BY name';
    topGuardsQuery += ' GROUP BY g.id_guardia ORDER BY rondas DESC LIMIT 5';

    const [roundsDaily] = await db.promise().query(roundsQuery, roundsParams);
    const [events] = await db.promise().query(eventsQuery, eventsParams);
    const [topGuards] = await db.promise().query(topGuardsQuery, topGuardsParams);

    res.json({ roundsDaily, events, topGuards });
  } catch (err) {
    console.error('Error en /dashboard/analytics:', err);
    res.status(500).json({ error: 'Error al obtener analíticas' });
  }
};

const obtenerEstadisticas = async (req, res) => {
  try {
    const [guards] = await db.promise().query('SELECT COUNT(*) as count FROM guardias WHERE activo = 1');
    const [panics] = await db.promise().query('SELECT COUNT(*) as count FROM alertas_panico WHERE DATE(fecha_hora) = CURDATE()');
    
    const roundsQuery = `
      SELECT 'daily' as period, COUNT(*) as total, SUM(CASE WHEN estado = "COMPLETADA" THEN 1 ELSE 0 END) as completed FROM rondas WHERE DATE(fecha) = CURDATE()
      UNION ALL
      SELECT 'weekly' as period, COUNT(*) as total, SUM(CASE WHEN estado = "COMPLETADA" THEN 1 ELSE 0 END) as completed FROM rondas WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      UNION ALL
      SELECT 'monthly' as period, COUNT(*) as total, SUM(CASE WHEN estado = "COMPLETADA" THEN 1 ELSE 0 END) as completed FROM rondas WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;
    
    const [roundsStats] = await db.promise().query(roundsQuery);
    
    const roundsData = {
      daily: { total: 0, completed: 0 },
      weekly: { total: 0, completed: 0 },
      monthly: { total: 0, completed: 0 }
    };

    roundsStats.forEach(row => {
      if (roundsData[row.period]) {
        roundsData[row.period] = {
          total: row.total,
          completed: Number(row.completed) || 0
        };
      }
    });

    res.json({
      activeGuards: guards[0].count,
      alerts: panics[0].count,
      rounds: roundsData
    });
  } catch (err) {
    console.error('Error en /dashboard/stats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

module.exports = {
  obtenerDatosMapa,
  obtenerAlertas,
  obtenerEventos,
  obtenerAnaliticas,
  obtenerEstadisticas
};