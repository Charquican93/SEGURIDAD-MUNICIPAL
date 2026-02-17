const db = require('../config/db');

function deg2rad(deg) { return deg * (Math.PI / 180); }
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const registrarMarcaje = async (req, res) => {
  const { id_ronda, id_punto, latitud, longitud } = req.body;
  if (!id_ronda || !id_punto) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [points] = await db.promise().query('SELECT id_punto, id_ruta, latitud_esperada, longitud_esperada, radio_tolerancia FROM puntos_control WHERE id_punto = ? OR nombre = ? LIMIT 1', [id_punto, id_punto]);
    if (points.length === 0) return res.status(404).json({ error: 'Punto no válido' });

    const point = points[0];
    if (point.latitud_esperada != null && point.longitud_esperada != null) {
      if (!latitud || !longitud) return res.status(400).json({ error: 'Se requiere GPS' });
      const dist = getDistanceFromLatLonInMeters(latitud, longitud, point.latitud_esperada, point.longitud_esperada);
      const tolerance = point.radio_tolerancia || 30;
      if (dist > tolerance) return res.status(400).json({ error: `Fuera de rango (${Math.round(dist)}m)` });
    }

    const [rondas] = await db.promise().query('SELECT id_ruta FROM rondas WHERE id_ronda = ?', [id_ronda]);
    if (rondas.length === 0) return res.status(404).json({ error: 'Ronda no encontrada' });
    const roundRouteId = rondas[0].id_ruta;

    if (point.id_ruta !== roundRouteId) return res.status(400).json({ error: 'Punto no corresponde a la ronda' });

    const [pointsInRoute] = await db.promise().query('SELECT id_punto FROM puntos_control WHERE id_ruta = ? ORDER BY id_punto ASC', [roundRouteId]);
    const currentIndex = pointsInRoute.findIndex(p => p.id_punto === point.id_punto);

    if (currentIndex > 0) {
      const previousPointId = pointsInRoute[currentIndex - 1].id_punto;
      const [prevMarcajes] = await db.promise().query('SELECT id_marcaje FROM marcajes_puntos WHERE id_ronda = ? AND id_punto = ?', [id_ronda, previousPointId]);
      if (prevMarcajes.length === 0) return res.status(400).json({ error: 'Orden incorrecto' });
    }

    const [dupMarcajes] = await db.promise().query('SELECT id_marcaje FROM marcajes_puntos WHERE id_ronda = ? AND id_punto = ?', [id_ronda, point.id_punto]);
    if (dupMarcajes.length > 0) return res.status(400).json({ error: 'Punto ya escaneado' });

    const [insertResult] = await db.promise().query('INSERT INTO marcajes_puntos (id_ronda, id_punto, latitud, longitud) VALUES (?, ?, ?, ?)', [id_ronda, point.id_punto, latitud, longitud]);

    const [totalRes] = await db.promise().query('SELECT COUNT(*) as total FROM puntos_control WHERE id_ruta = ?', [roundRouteId]);
    const [marcadosRes] = await db.promise().query('SELECT COUNT(DISTINCT id_punto) as marcados FROM marcajes_puntos WHERE id_ronda = ?', [id_ronda]);
    
    const roundCompleted = marcadosRes[0].marcados >= totalRes[0].total;
    if (roundCompleted) {
      await db.promise().query('UPDATE rondas SET estado = "COMPLETADA" WHERE id_ronda = ?', [id_ronda]);
    } else {
      await db.promise().query('UPDATE rondas SET estado = "EN_PROGRESO" WHERE id_ronda = ? AND estado = "PENDIENTE"', [id_ronda]);
    }

    res.json({ success: true, id_marcaje: insertResult.insertId, roundCompleted, progress: { current: marcadosRes[0].marcados, total: totalRes[0].total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
};

const obtenerRondas = (req, res) => {
  const { id_guardia, id_puesto, fecha, periodo, estado } = req.query;
  let query = `SELECT r.*, ru.nombre as nombre_ruta, ru.descripcion, g.nombre as nombre_guardia, g.apellido as apellido_guardia, (SELECT COUNT(*) FROM puntos_control pc WHERE pc.id_ruta = r.id_ruta) as total_puntos, (SELECT COUNT(DISTINCT mp.id_punto) FROM marcajes_puntos mp WHERE mp.id_ronda = r.id_ronda) as puntos_marcados FROM rondas r LEFT JOIN rutas ru ON r.id_ruta = ru.id_ruta LEFT JOIN guardias g ON r.id_guardia = g.id_guardia`;
  const params = [];
  const conditions = [];

  if (id_guardia) { conditions.push('r.id_guardia = ?'); params.push(id_guardia); }
  if (id_puesto) { conditions.push('ru.id_puesto = ?'); params.push(id_puesto); }
  if (periodo === 'hoy') conditions.push('DATE(r.fecha) = CURDATE()');
  else if (periodo === 'ayer') conditions.push('DATE(r.fecha) = SUBDATE(CURDATE(), 1)');
  else if (periodo === 'semana') conditions.push('r.fecha >= SUBDATE(CURDATE(), 7)');
  else if (periodo === 'mes') conditions.push('r.fecha >= SUBDATE(CURDATE(), 30)');
  else if (fecha) { conditions.push('DATE(r.fecha) = ?'); params.push(fecha); }
  if (estado && estado !== 'TODAS') { conditions.push('r.estado = ?'); params.push(estado); }
  
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY r.fecha DESC, r.hora ASC';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener rondas' });
    res.json(results);
  });
};

const actualizarEstadoRonda = (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  db.query('UPDATE rondas SET estado = ? WHERE id_ronda = ?', [estado, id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar' });
    res.json({ success: true, affected: result.affectedRows });
  });
};

const obtenerPuntosRonda = (req, res) => {
  const { id } = req.params;
  db.query('SELECT id_ruta FROM rondas WHERE id_ronda = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Ronda no encontrada' });
    const id_ruta = results[0].id_ruta;
    const query = `SELECT pc.id_punto, pc.nombre, pc.descripcion, CASE WHEN mp.id_marcaje IS NOT NULL THEN 1 ELSE 0 END as marcado, mp.fecha_hora as hora_marcaje FROM puntos_control pc LEFT JOIN marcajes_puntos mp ON pc.id_punto = mp.id_punto AND mp.id_ronda = ? WHERE pc.id_ruta = ? ORDER BY pc.id_punto ASC`;
    db.query(query, [id, id_ruta], (errPoints, points) => {
      if (errPoints) return res.status(500).json({ error: 'Error al obtener puntos' });
      res.json(points);
    });
  });
};

module.exports = { registrarMarcaje, obtenerRondas, actualizarEstadoRonda, obtenerPuntosRonda };
