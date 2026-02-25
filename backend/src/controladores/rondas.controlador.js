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
  const { id_guardia, id_puesto, fecha, fecha_inicio, fecha_fin, periodo, estado } = req.query;
  let query = `SELECT r.*, ru.nombre as nombre_ruta, ru.descripcion, ru.id_puesto, g.nombre as nombre_guardia, g.apellido as apellido_guardia, (SELECT COUNT(*) FROM puntos_control pc WHERE pc.id_ruta = r.id_ruta) as total_puntos, (SELECT COUNT(DISTINCT mp.id_punto) FROM marcajes_puntos mp WHERE mp.id_ronda = r.id_ronda) as puntos_marcados FROM rondas r LEFT JOIN rutas ru ON r.id_ruta = ru.id_ruta LEFT JOIN guardias g ON r.id_guardia = g.id_guardia`;
  const params = [];
  const conditions = [];

  if (id_guardia) { conditions.push('r.id_guardia = ?'); params.push(id_guardia); }
  if (id_puesto) { conditions.push('ru.id_puesto = ?'); params.push(id_puesto); }
  if (fecha_inicio && fecha_fin) { conditions.push('r.fecha BETWEEN ? AND ?'); params.push(fecha_inicio, fecha_fin); }
  else if (periodo === 'hoy') conditions.push('DATE(r.fecha) = CURDATE()');
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
    // Modificamos la consulta para traer las coordenadas esperadas (pc) y las reales (mp)
    const query = `SELECT pc.id_punto, pc.nombre, pc.descripcion, pc.latitud_esperada, pc.longitud_esperada, pc.radio_tolerancia, mp.latitud as lat_real, mp.longitud as lon_real, CASE WHEN mp.id_marcaje IS NOT NULL THEN 1 ELSE 0 END as marcado, mp.fecha_hora as hora_marcaje FROM puntos_control pc LEFT JOIN marcajes_puntos mp ON pc.id_punto = mp.id_punto AND mp.id_ronda = ? WHERE pc.id_ruta = ? ORDER BY pc.id_punto ASC`;
    
    db.query(query, [id, id_ruta], (errPoints, points) => {
      if (errPoints) return res.status(500).json({ error: 'Error al obtener puntos' });
      
      // Procesamos cada punto para calcular la distancia y el estado GPS
      const puntosProcesados = points.map(p => {
        let distancia = 0;
        let estado_gps = 'PENDIENTE';

        if (p.marcado) {
          if (p.latitud_esperada && p.longitud_esperada && p.lat_real && p.lon_real) {
            distancia = getDistanceFromLatLonInMeters(p.lat_real, p.lon_real, p.latitud_esperada, p.longitud_esperada);
            const tolerancia = p.radio_tolerancia || 30; // Usar tolerancia del punto o 30m por defecto
            estado_gps = distancia <= tolerancia ? 'OK' : 'FUERA_RANGO';
          } else {
            estado_gps = 'SIN_GPS'; // Marcado pero sin datos de ubicación para comparar
          }
        }

        return { ...p, distancia: Math.round(distancia), estado_gps };
      });

      res.json(puntosProcesados);
    });
  });
};

const crearRonda = async (req, res) => {
  let { id_guardia, id_ruta, id_puesto, fecha, hora, hora_fin, estado } = req.body;

  if (!id_guardia || (!id_ruta && !id_puesto) || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // LÓGICA DE RESOLUCIÓN DE RUTA (Corrección para confusión Puesto vs Ruta)
    
    // Caso 1: Si el frontend envía explícitamente id_puesto en lugar de id_ruta
    if (!id_ruta && id_puesto) {
      const [rutas] = await db.promise().query('SELECT id_ruta FROM rutas WHERE id_puesto = ? LIMIT 1', [id_puesto]);
      if (rutas.length > 0) {
        id_ruta = rutas[0].id_ruta;
      } else {
        // AUTO-CREAR RUTA: Si el puesto no tiene ruta, creamos una por defecto para evitar bloqueo
        const [newRoute] = await db.promise().query('INSERT INTO rutas (nombre, descripcion, id_puesto) VALUES (?, ?, ?)', [`Ruta Puesto ${id_puesto}`, 'Ruta generada automáticamente', id_puesto]);
        id_ruta = newRoute.insertId;
      }
    }
    // Caso 2: Si envía un ID en id_ruta, verificamos si es válido o si es un ID de Puesto camuflado
    else if (id_ruta) {
      const [rutaExiste] = await db.promise().query('SELECT id_ruta FROM rutas WHERE id_ruta = ?', [id_ruta]);
      
      if (rutaExiste.length === 0) {
        // No existe la ruta. Verificamos si el ID corresponde a un Puesto que tenga ruta
        const [rutasDelPuesto] = await db.promise().query('SELECT id_ruta FROM rutas WHERE id_puesto = ? LIMIT 1', [id_ruta]);
        if (rutasDelPuesto.length > 0) {
          id_ruta = rutasDelPuesto[0].id_ruta; // ¡Corregido! Usamos la ruta real del puesto
        } else {
           // Verificamos si el ID corresponde a un Puesto válido sin rutas
           const [puestoExiste] = await db.promise().query('SELECT id_puesto FROM puestos WHERE id_puesto = ?', [id_ruta]);
           if (puestoExiste.length > 0) {
               // Es un puesto válido, le creamos su primera ruta
               const [newRoute] = await db.promise().query('INSERT INTO rutas (nombre, descripcion, id_puesto) VALUES (?, ?, ?)', [`Ruta Puesto ${id_ruta}`, 'Ruta generada automáticamente', id_ruta]);
               id_ruta = newRoute.insertId;
           } else {
               return res.status(400).json({ error: `No se encontró la Ruta ID ${id_ruta} ni un puesto asociado con ese ID.` });
           }
        }
      }
    }

    const [result] = await db.promise().query(
      'INSERT INTO rondas (id_guardia, id_ruta, fecha, hora, hora_fin, estado) VALUES (?, ?, ?, ?, ?, ?)',
      [id_guardia, id_ruta, fecha, hora, hora_fin || null, estado || 'PENDIENTE']
    );

    res.json({ 
      message: 'Ronda programada exitosamente', 
      id_ronda: result.insertId 
    });
  } catch (error) {
    console.error('Error al crear ronda:', error);
    res.status(500).json({ error: 'Error al programar la ronda: ' + error.message });
  }
};

const eliminarRonda = async (req, res) => {
  const { id } = req.params;

  try {
    // Primero eliminamos los marcajes asociados para evitar error de llave foránea
    await db.promise().query('DELETE FROM marcajes_puntos WHERE id_ronda = ?', [id]);
    await db.promise().query('DELETE FROM rondas WHERE id_ronda = ?', [id]);
    res.json({ message: 'Ronda eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar ronda:', error);
    res.status(500).json({ error: 'Error al eliminar la ronda' });
  }
};

const editarRonda = async (req, res) => {
  const { id } = req.params;
  let { id_guardia, id_ruta, id_puesto, fecha, hora, hora_fin } = req.body;

  try {
    // Si viene id_puesto pero no id_ruta, buscamos la ruta asociada
    if (!id_ruta && id_puesto) {
      const [rutas] = await db.promise().query('SELECT id_ruta FROM rutas WHERE id_puesto = ? LIMIT 1', [id_puesto]);
      if (rutas.length > 0) id_ruta = rutas[0].id_ruta;
      else return res.status(400).json({ error: 'El puesto seleccionado no tiene rutas asignadas.' });
    }

    await db.promise().query(
      'UPDATE rondas SET id_guardia = ?, id_ruta = ?, fecha = ?, hora = ?, hora_fin = ? WHERE id_ronda = ?',
      [id_guardia, id_ruta, fecha, hora, hora_fin || null, id]
    );
    res.json({ message: 'Ronda actualizada correctamente' });
  } catch (error) {
    console.error('Error al editar ronda:', error);
    res.status(500).json({ error: 'Error al editar la ronda' });
  }
};

module.exports = { registrarMarcaje, obtenerRondas, actualizarEstadoRonda, obtenerPuntosRonda, crearRonda, eliminarRonda, editarRonda };
