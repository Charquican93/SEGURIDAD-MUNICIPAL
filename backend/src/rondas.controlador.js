const db = require('../config/db');

// Funciones auxiliares para cálculo de distancia (Fórmula de Haversine)
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la tierra en metros
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Registrar marcaje de punto QR
const registrarMarcaje = async (req, res) => {
  const { id_ronda, id_punto, latitud, longitud } = req.body;

  if (!id_ronda || !id_punto) {
    return res.status(400).json({ error: 'Faltan datos del marcaje' });
  }

  try {
    // 1. Buscar el ID real del punto (permite que el QR tenga el ID "1" o el nombre "E1-P1")
    const [points] = await db.promise().query(
      'SELECT id_punto, id_ruta, latitud_esperada, longitud_esperada, radio_tolerancia FROM puntos_control WHERE id_punto = ? OR nombre = ? LIMIT 1',
      [id_punto, id_punto]
    );

    if (points.length === 0) {
      return res.status(404).json({ error: 'Punto de control no válido o no encontrado en BD' });
    }

    const point = points[0];
    const realIdPunto = point.id_punto;
    const pointRouteId = point.id_ruta;

    // Validación de geolocalización (si el punto tiene coordenadas esperadas configuradas)
    if (point.latitud_esperada != null && point.longitud_esperada != null) {
      if (!latitud || !longitud) {
        return res.status(400).json({ error: 'Se requiere ubicación GPS para validar este punto.' });
      }
      
      const dist = getDistanceFromLatLonInMeters(latitud, longitud, point.latitud_esperada, point.longitud_esperada);
      const tolerance = point.radio_tolerancia || 30; // Usar tolerancia de la BD o 30m por defecto

      if (dist > tolerance) {
        return res.status(400).json({ error: `Estás fuera del rango permitido (${Math.round(dist)}m). Acércate al punto.` });
      }
    }

    // 2. Obtener la ruta de la ronda para validar
    const [rondas] = await db.promise().query('SELECT id_ruta FROM rondas WHERE id_ronda = ?', [id_ronda]);
    if (rondas.length === 0) return res.status(404).json({ error: 'Ronda no encontrada' });

    const roundRouteId = rondas[0].id_ruta;

    // VALIDACIÓN 1: El punto debe pertenecer a la ruta de la ronda
    if (pointRouteId !== roundRouteId) {
      return res.status(400).json({ error: 'Este punto no corresponde a la ronda actual.' });
    }

    // VALIDACIÓN 2: Verificar orden secuencial
    const [pointsInRoute] = await db.promise().query('SELECT id_punto FROM puntos_control WHERE id_ruta = ? ORDER BY id_punto ASC', [roundRouteId]);
    const currentIndex = pointsInRoute.findIndex(p => p.id_punto === realIdPunto);

    // Si no es el primer punto de la lista, verificar que el anterior esté marcado
    if (currentIndex > 0) {
      const previousPointId = pointsInRoute[currentIndex - 1].id_punto;
      const [prevMarcajes] = await db.promise().query('SELECT id_marcaje FROM marcajes_puntos WHERE id_ronda = ? AND id_punto = ?', [id_ronda, previousPointId]);
      
      if (prevMarcajes.length === 0) {
        return res.status(400).json({ error: 'Orden incorrecto: Debes marcar el punto anterior primero.' });
      }
    }

    // VALIDACIÓN 3: El punto no debe haber sido escaneado previamente en esta ronda
    const [dupMarcajes] = await db.promise().query('SELECT id_marcaje FROM marcajes_puntos WHERE id_ronda = ? AND id_punto = ?', [id_ronda, realIdPunto]);
    if (dupMarcajes.length > 0) {
      return res.status(400).json({ error: 'Este punto ya fue escaneado en esta ronda.' });
    }

    // 4. Insertar marcaje
    const [insertResult] = await db.promise().query(
      'INSERT INTO marcajes_puntos (id_ronda, id_punto, latitud, longitud) VALUES (?, ?, ?, ?)',
      [id_ronda, realIdPunto, latitud, longitud]
    );

    // 5. Calcular progreso
    const [totalRes] = await db.promise().query('SELECT COUNT(*) as total FROM puntos_control WHERE id_ruta = ?', [roundRouteId]);
    const totalPuntos = totalRes[0].total;

    const [marcadosRes] = await db.promise().query('SELECT COUNT(DISTINCT id_punto) as marcados FROM marcajes_puntos WHERE id_ronda = ?', [id_ronda]);
    const puntosMarcados = marcadosRes[0].marcados;

    const roundCompleted = puntosMarcados >= totalPuntos;
    if (roundCompleted) {
      await db.promise().query('UPDATE rondas SET estado = "COMPLETADA" WHERE id_ronda = ?', [id_ronda]);
    } else {
      await db.promise().query('UPDATE rondas SET estado = "EN_PROGRESO" WHERE id_ronda = ? AND estado = "PENDIENTE"', [id_ronda]);
    }

    res.json({ 
      success: true, 
      id_marcaje: insertResult.insertId, 
      roundCompleted, 
      progress: { current: puntosMarcados, total: totalPuntos } 
    });

  } catch (err) {
    console.error('Error en /marcajes:', err.message);
    res.status(500).json({ error: 'Error interno del servidor al registrar marcaje' });
  }
};

// Obtener rondas asignadas
const obtenerRondas = (req, res) => {
  const { id_guardia, id_puesto, fecha, periodo, estado } = req.query;
  
  let query = `
    SELECT 
      r.*, 
      ru.nombre as nombre_ruta, 
      ru.descripcion,
      g.nombre as nombre_guardia,
      g.apellido as apellido_guardia,
      (SELECT COUNT(*) FROM puntos_control pc WHERE pc.id_ruta = r.id_ruta) as total_puntos,
      (SELECT COUNT(DISTINCT mp.id_punto) FROM marcajes_puntos mp WHERE mp.id_ronda = r.id_ronda) as puntos_marcados
    FROM rondas r
    LEFT JOIN rutas ru ON r.id_ruta = ru.id_ruta
    LEFT JOIN guardias g ON r.id_guardia = g.id_guardia
  `;
  
  const params = [];
  const conditions = [];

  if (id_guardia) {
    conditions.push('r.id_guardia = ?');
    params.push(id_guardia);
  }
  if (id_puesto) {
    conditions.push('ru.id_puesto = ?');
    params.push(id_puesto);
  }
  
  // Filtros de fecha / periodo
  if (periodo) {
    if (periodo === 'hoy') conditions.push('DATE(r.fecha) = CURDATE()');
    else if (periodo === 'ayer') conditions.push('DATE(r.fecha) = SUBDATE(CURDATE(), 1)');
    else if (periodo === 'semana') conditions.push('r.fecha >= SUBDATE(CURDATE(), 7)');
    else if (periodo === 'mes') conditions.push('r.fecha >= SUBDATE(CURDATE(), 30)');
    // 'todos' no agrega condición
  } else if (fecha) {
    if (fecha === 'hoy') {
      conditions.push('DATE(r.fecha) = CURDATE()');
    } else {
      conditions.push('DATE(r.fecha) = ?');
      params.push(fecha);
    }
  }

  // Filtro de estado
  if (estado && estado !== 'TODAS') {
    conditions.push('r.estado = ?');
    params.push(estado);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY r.fecha DESC, r.hora ASC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error al obtener rondas:', err);
      return res.status(500).json({ error: 'Error al obtener rondas' });
    }
    res.json(results);
  });
};

// Actualizar estado de una ronda
const actualizarEstadoRonda = (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  
  if (!estado) {
    return res.status(400).json({ error: 'Falta el estado' });
  }

  db.query('UPDATE rondas SET estado = ? WHERE id_ronda = ?', [estado, id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error al actualizar estado de la ronda' });
    }
    res.json({ success: true, affected: result.affectedRows });
  });
};

// Obtener puntos de una ronda específica (con estado de marcaje)
const obtenerPuntosRonda = (req, res) => {
  const { id } = req.params;
  
  // 1. Obtener id_ruta de la ronda
  db.query('SELECT id_ruta FROM rondas WHERE id_ronda = ?', [id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener ruta de la ronda' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'Ronda no encontrada' });
    
    const id_ruta = results[0].id_ruta;
    
    // 2. Obtener puntos y estado de marcaje
    const query = `
      SELECT 
        pc.id_punto,
        pc.nombre,
        pc.descripcion,
        CASE WHEN mp.id_marcaje IS NOT NULL THEN 1 ELSE 0 END as marcado,
        mp.fecha_hora as hora_marcaje
      FROM puntos_control pc
      LEFT JOIN marcajes_puntos mp ON pc.id_punto = mp.id_punto AND mp.id_ronda = ?
      WHERE pc.id_ruta = ?
      ORDER BY pc.id_punto ASC
    `;
    
    db.query(query, [id, id_ruta], (errPoints, points) => {
      if (errPoints) {
        console.error(errPoints);
        return res.status(500).json({ error: 'Error al obtener puntos de control' });
      }
      res.json(points);
    });
  });
};

module.exports = {
  registrarMarcaje,
  obtenerRondas,
  actualizarEstadoRonda,
  obtenerPuntosRonda
};