const db = require('../config/db');

// Obtener historial de turnos con detalles de cumplimiento
const obtenerTurnos = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado, search, periodo } = req.query;
    
    let query = `
      SELECT 
        t.id_turno, 
        t.fecha, 
        t.hora_inicio, 
        t.hora_fin, 
        g.nombre as nombre_guardia, 
        g.apellido as apellido_guardia, 
        g.rut as rut_guardia,
        COALESCE(p.puesto, (
          SELECT p_sub.puesto 
          FROM rondas r_sub 
          JOIN rutas ru_sub ON r_sub.id_ruta = ru_sub.id_ruta 
          JOIN puestos p_sub ON ru_sub.id_puesto = p_sub.id_puesto 
          WHERE r_sub.fecha = t.fecha AND r_sub.id_guardia = t.id_guardia 
          LIMIT 1
        )) as nombre_puesto,
        -- Subconsulta para contar rondas totales asignadas ese día
        (SELECT COUNT(*) FROM rondas r 
         WHERE r.fecha = t.fecha AND r.id_guardia = t.id_guardia) as rondas_totales,
        -- Subconsulta para contar rondas completadas
        (SELECT COUNT(*) FROM rondas r 
         WHERE r.fecha = t.fecha AND r.id_guardia = t.id_guardia 
         AND r.estado = 'COMPLETADA') as rondas_completadas,
        -- Subconsulta para obtener la hora de la primera ronda (para calcular atrasos)
        (SELECT MIN(hora) FROM rondas r 
         WHERE r.fecha = t.fecha AND r.id_guardia = t.id_guardia) as hora_programada,
        -- Subconsulta para obtener la hora fin de la última ronda (para calcular salida anticipada/tarde)
        (SELECT MAX(hora_fin) FROM rondas r 
         WHERE r.fecha = t.fecha AND r.id_guardia = t.id_guardia) as hora_fin_programada
      FROM turnos t
      LEFT JOIN guardias g ON t.id_guardia = g.id_guardia
      LEFT JOIN puestos p ON t.id_puesto = p.id_puesto
      WHERE 1=1
    `;
    
    const params = [];

    // Filtro por Fechas
    if (fecha_inicio && fecha_fin) {
      query += ` AND t.fecha BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }
    // Filtro por Periodo (si no vienen fechas explícitas)
    else if (periodo) {
      if (periodo === 'hoy') {
        query += ` AND t.fecha = CURDATE()`;
      } else if (periodo === 'ayer') {
        query += ` AND t.fecha = SUBDATE(CURDATE(), 1)`;
      } else if (periodo === 'semana') {
        query += ` AND t.fecha >= SUBDATE(CURDATE(), 7)`;
      } else if (periodo === 'mes') {
        query += ` AND t.fecha >= SUBDATE(CURDATE(), 30)`;
      }
    }

    // Filtro por Estado
    if (estado && estado !== 'TODOS') {
      if (estado === 'ACTIVO') {
        query += ` AND t.hora_fin IS NULL`;
      } else if (estado === 'CERRADO') {
        query += ` AND t.hora_fin IS NOT NULL`;
      }
    }

    // Búsqueda por nombre o RUT
    if (search) {
      query += ` AND (g.nombre LIKE ? OR g.apellido LIKE ? OR g.rut LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY t.fecha DESC, t.hora_inicio DESC`;

    const [rows] = await db.promise().query(query, params);
    res.json(rows);

  } catch (error) {
    console.error('Error al obtener turnos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Iniciar un nuevo turno
const iniciarTurno = async (req, res) => {
  const { id_guardia, id_puesto } = req.body;
  if (!id_guardia) return res.status(400).json({ error: 'Falta id_guardia' });

  try {
    // Insertamos el turno con la fecha y hora actual del servidor
    const [result] = await db.promise().query(
      'INSERT INTO turnos (id_guardia, id_puesto, fecha, hora_inicio) VALUES (?, ?, CURDATE(), CURTIME())',
      [id_guardia, id_puesto || null]
    );

    // Actualizamos el estado del guardia a ACTIVO
    await db.promise().query('UPDATE guardias SET activo = 1 WHERE id_guardia = ?', [id_guardia]);

    res.json({ success: true, id_turno: result.insertId });
  } catch (error) {
    console.error('Error al iniciar turno:', error);
    res.status(500).json({ error: 'Error al iniciar turno' });
  }
};

// Terminar un turno existente
const terminarTurno = async (req, res) => {
  const { id } = req.params;
  try {
    // Actualizamos la hora de fin
    const [result] = await db.promise().query(
      'UPDATE turnos SET hora_fin = CURTIME() WHERE id_turno = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    // Buscamos al guardia asociado para desactivarlo
    const [rows] = await db.promise().query('SELECT id_guardia FROM turnos WHERE id_turno = ?', [id]);
    if (rows.length > 0) {
       await db.promise().query('UPDATE guardias SET activo = 0 WHERE id_guardia = ?', [rows[0].id_guardia]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al terminar turno:', error);
    res.status(500).json({ error: 'Error al terminar turno' });
  }
};

module.exports = { obtenerTurnos, iniciarTurno, terminarTurno };
