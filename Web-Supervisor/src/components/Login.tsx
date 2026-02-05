import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import type { UserProfile } from '../types';
import '../Login.css'; // Crearemos este archivo de estilos a continuación

const Login: React.FC = () => {
  const [rut, setRut] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limpiar caracteres no válidos y limitar largo
    let value = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (value.length > 9) value = value.slice(0, 9);

    if (value.length > 1) {
      const body = value.slice(0, -1);
      const dv = value.slice(-1);
      setRut(`${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`);
    } else {
      setRut(value);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Usamos el mismo endpoint que la App móvil
      const response = await axios.post(`${API_URL}/login`, {
        rut,
        contrasena
      });

      if (response.data && response.data.guardia) {
        const user: UserProfile = response.data.guardia;
        
        // Verificar si es supervisor (puedes ajustar esta lógica según tus roles)
        // Por ahora permitimos el acceso y guardamos la sesión
        localStorage.setItem('userSession', JSON.stringify(user));
        
        // Redirigir al dashboard (que crearemos luego)
        navigate('/dashboard');
      } else {
        setError('Respuesta inválida del servidor');
      }
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Error al conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Supervisor de Seguridad</h2>
        <p>Ingrese sus credenciales</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="rut">RUT</label>
            <input
              type="text"
              id="rut"
              value={rut}
              onChange={handleRutChange}
              placeholder="12.345.678-9"
              required
              maxLength={12}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
