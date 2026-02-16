const db = require('../config/db');
const bcrypt = require('bcrypt');

const login = async (req, res) => {
  const { rut, contrasena } = req.body;
  
  if (!rut || !contrasena) {
    return res.status(400).json({ error: 'Faltan datos de acceso' });
  }

  try {
    // 1. Buscar en tabla SUPERVISORES
    const [supervisores] = await db.promise().query('SELECT * FROM supervisores WHERE rut = ?', [rut]);
    
    if (supervisores.length > 0) {
      const supervisor = supervisores[0];
      let match = false;
      try {
        match = await bcrypt.compare(contrasena, supervisor.contrasena);
      } catch (e) {}

      // Fallback: Si falla bcrypt, probar texto plano (para usuarios antiguos o creados manualmente)
      if (!match && contrasena === supervisor.contrasena) {
        match = true;
        // Auto-encriptar contraseña para mejorar seguridad futura
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(contrasena, salt);
        db.query('UPDATE supervisores SET contrasena = ? WHERE rut = ?', [hash, rut]);
      }

      if (match) {
        const userResponse = { ...supervisor };
        delete userResponse.contrasena;
        
        // Adaptar estructura para el frontend
        // Asumimos que la tabla tiene id_supervisor, si no, usa id o lo que tenga
        userResponse.id_guardia = supervisor.id_supervisor || supervisor.id; 
        userResponse.role = 'supervisor';
        userResponse.isActive = true; // Supervisores siempre activos
        
        return res.json({ guardia: userResponse });
      }
    }

    // 2. Si no es supervisor, buscar en tabla GUARDIAS
    const [guardias] = await db.promise().query('SELECT * FROM guardias WHERE rut = ?', [rut]);

    if (guardias.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const guardia = guardias[0];
    let match = false;
    try {
      match = await bcrypt.compare(contrasena, guardia.contrasena);
    } catch (e) {}

    // Fallback: Si falla bcrypt, probar texto plano (para usuarios antiguos)
    if (!match && contrasena === guardia.contrasena) {
      match = true;
      // Auto-encriptar contraseña para mejorar seguridad futura
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(contrasena, salt);
      db.query('UPDATE guardias SET contrasena = ? WHERE id_guardia = ?', [hash, guardia.id_guardia]);
    }

    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Preparar respuesta guardia
    const guardiaDB = { ...guardia };
    delete guardiaDB.contrasena;
    
    const userResponse = {
      ...guardiaDB,
      isActive: !!guardiaDB.activo,
      role: 'guardia'
    };
    delete userResponse.activo;

    // Lógica de turno para guardias
    if (userResponse.isActive) {
      const [turnos] = await db.promise().query(
        'SELECT id_turno, id_puesto FROM turnos WHERE id_guardia = ? AND hora_fin IS NULL ORDER BY id_turno DESC LIMIT 1',
        [userResponse.id_guardia]
      );
      const activeTurn = turnos.length > 0 ? turnos[0] : null;
      return res.json({ guardia: userResponse, activeTurn });
    } else {
      // Sugerencia de puesto
      const findRondasQuery = `
        SELECT ru.id_puesto, p.puesto, p.instalaciones 
        FROM rondas r
        JOIN rutas ru ON r.id_ruta = ru.id_ruta
        JOIN puestos p ON ru.id_puesto = p.id_puesto
        WHERE r.id_guardia = ? AND r.fecha = CURDATE() 
        LIMIT 1`;
      
      const [rondas] = await db.promise().query(findRondasQuery, [userResponse.id_guardia]);
      
      if (rondas.length > 0) {
        const puestoSugerido = rondas[0];
        return res.json({ guardia: userResponse, puestoSugerido });
      } else {
        return res.json({ guardia: userResponse });
      }
    }

  } catch (err) {
    console.log('Error MySQL:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };