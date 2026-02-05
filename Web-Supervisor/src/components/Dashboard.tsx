import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    activeGuards: 0,
    alerts: 0,
    roundsCompleted: 0,
    roundsTotal: 0
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeGuards, setActiveGuards] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes, mapRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/stats`),
        axios.get(`${API_URL}/dashboard/alerts`),
        axios.get(`${API_URL}/dashboard/map-data`)
      ]);
      
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
      setActiveGuards(mapRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const roundProgress = stats.roundsTotal > 0 
    ? Math.round((stats.roundsCompleted / stats.roundsTotal) * 100) 
    : 0;

  return (
    <Layout title="Panel de Control">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Tarjeta de Ejemplo 1 */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Guardias Activos</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0', color: '#3182ce' }}>{stats.activeGuards}</p>
          <small style={{ color: '#718096' }}>En turno actualmente</small>
        </div>

        {/* Tarjeta de Ejemplo 2 */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Alertas Hoy</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0', color: '#e53e3e' }}>{stats.alerts}</p>
          <small style={{ color: '#718096' }}>Botones de pánico o incidencias</small>
        </div>

        {/* Tarjeta de Ejemplo 3 */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Rondas Completadas</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0', color: '#38a169' }}>{roundProgress}%</p>
          <small style={{ color: '#718096' }}>{stats.roundsCompleted} de {stats.roundsTotal} programadas</small>
        </div>

      </div>

      {/* Sección Inferior: Mapa y Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '30px' }}>
        
        {/* Contenedor del Mapa */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: '400px' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Mapa en Tiempo Real</h3>
          <div style={{ background: '#f8fafc', height: '320px', borderRadius: '4px', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>Vista de mapa pendiente</p>
            <div style={{ width: '100%', padding: '0 20px', overflowY: 'auto' }}>
               <p style={{ fontWeight: 'bold', color: '#2d3748', marginBottom: '10px', textAlign: 'center' }}>
                 Guardias Activos: {activeGuards.length}
               </p>
               {activeGuards.map((guard: any) => (
                 <div key={guard.id_guardia} style={{ marginBottom: '8px', padding: '8px', background: 'white', borderRadius: '4px', border: '1px solid #edf2f7' }}>
                   <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{guard.nombre} {guard.apellido}</div>
                   <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                     Lat: {guard.latitud}, Lon: {guard.longitud}
                   </div>
                   <div style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                     {new Date(guard.fecha_hora).toLocaleTimeString()}
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Tabla de Últimas Alertas */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: '400px', overflowY: 'auto' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Últimas Alertas</h3>
          {alerts.length === 0 ? (
            <p style={{ color: '#718096' }}>No hay alertas recientes.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {alerts.map((alert: any, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{ 
                        backgroundColor: alert.tipo === 'PÁNICO' ? '#fed7d7' : '#feebc8', 
                        color: alert.tipo === 'PÁNICO' ? '#c53030' : '#c05621',
                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' 
                      }}>{alert.tipo}</span>
                    </td>
                    <td style={{ padding: '10px 0', color: '#2d3748' }}>
                      <div>{alert.descripcion}</div>
                      <div style={{ fontWeight: 'bold' }}>{alert.nombre} {alert.apellido}</div>
                      <div style={{ fontSize: '0.85rem' }}>{alert.descripcion}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {new Date(alert.fecha_hora).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default Dashboard;