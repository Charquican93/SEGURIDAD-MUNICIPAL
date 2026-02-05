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
  const [puestos, setPuestos] = useState<any[]>([]);
  const [guardias, setGuardias] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedGuard, setSelectedGuard] = useState<any>(null);
  const [guardRounds, setGuardRounds] = useState<any[]>([]);
  const [guardChecks, setGuardChecks] = useState<any[]>([]);
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [selectedPuesto, setSelectedPuesto] = useState<any>(null);
  const [puestoRounds, setPuestoRounds] = useState<any[]>([]);
  const [showPuestoModal, setShowPuestoModal] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
  const [roundPoints, setRoundPoints] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  const fetchData = async () => {
    // 1. Cargar estadísticas
    try {
      const response = await axios.get(`${API_URL}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }

    // 2. Cargar alertas
    try {
      const response = await axios.get(`${API_URL}/dashboard/alerts`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }

    // 3. Cargar eventos
    try {
      const response = await axios.get(`${API_URL}/dashboard/events`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }

    // 4. Cargar puestos y guardias por separado
    try {
      const [puestosRes, guardiasRes] = await Promise.all([
        axios.get(`${API_URL}/puestos`),
        axios.get(`${API_URL}/guardias`)
      ]);
      setPuestos(puestosRes.data);
      setGuardias(guardiasRes.data);
    } catch (error) {
      console.error('Error fetching puestos:', error);
      console.error('Error fetching auxiliary data:', error);
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

  const handleGuardClick = async (guard: any) => {
    setSelectedGuard(guard);
    setShowGuardModal(true);
    setGuardRounds([]); // Limpiar anteriores
    setGuardChecks([]); // Limpiar anteriores
    setExpandedRoundId(null); // Resetear ronda expandida
    setRoundPoints([]);
    try {
      const [detailsRes, roundsRes, checksRes] = await Promise.all([
        axios.get(`${API_URL}/guardias/${guard.id_guardia}`),
        axios.get(`${API_URL}/rondas?id_guardia=${guard.id_guardia}`),
        axios.get(`${API_URL}/checks?id_guardia=${guard.id_guardia}`)
      ]);
      setSelectedGuard(detailsRes.data);
      setGuardRounds(roundsRes.data);
      setGuardChecks(checksRes.data);
    } catch (error) {
      console.error('Error fetching guard details:', error);
    }
  };

  const closeGuardModal = () => {
    setShowGuardModal(false);
    setSelectedGuard(null);
    setExpandedRoundId(null);
  };

  const handleRoundClick = async (roundId: string) => {
    if (expandedRoundId === roundId) {
      setExpandedRoundId(null);
      setRoundPoints([]);
      return;
    }

    setExpandedRoundId(roundId);
    setRoundPoints([]);
    setLoadingPoints(true);
    try {
      const response = await axios.get(`${API_URL}/rondas/${roundId}/puntos`);
      setRoundPoints(response.data);
    } catch (error) {
      console.error('Error fetching round points:', error);
    } finally {
      setLoadingPoints(false);
    }
  };

  const handlePuestoClick = async (puesto: any) => {
    setSelectedPuesto(puesto);
    setShowPuestoModal(true);
    setPuestoRounds([]);
    try {
      const response = await axios.get(`${API_URL}/rondas?id_puesto=${puesto.id_puesto}`);
      setPuestoRounds(response.data);
    } catch (error) {
      console.error('Error fetching puesto rounds:', error);
    }
  };

  const closePuestoModal = () => {
    setShowPuestoModal(false);
    setSelectedPuesto(null);
  };

  return (
    <Layout title="Panel de Control">
      {/* Puestos (Almohadillas Horizontales) */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '15px' }}>Puestos</h3>
        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
          {puestos.length === 0 ? (
            <div style={{ padding: '15px', background: 'white', borderRadius: '8px', color: '#718096' }}>
              No hay puestos registrados.
            </div>
          ) : (
            puestos.map((puesto: any) => (
              <div key={puesto.id_puesto} onClick={() => handlePuestoClick(puesto)} style={{ 
                minWidth: '200px',
                background: 'white', 
                padding: '15px', 
                borderRadius: '12px', 
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}>
                <div style={{ fontWeight: 'bold', color: '#2d3748', fontSize: '1rem' }}>{puesto.puesto}</div>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '4px' }}>{puesto.instalaciones}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Guardias (Almohadillas Horizontales) */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '15px' }}>Guardias Registrados</h3>
        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
          {guardias.length === 0 ? (
            <div style={{ padding: '15px', background: 'white', borderRadius: '8px', color: '#718096' }}>
              No hay guardias registrados.
            </div>
          ) : (
            guardias.map((guardia: any) => (
              <div key={guardia.id_guardia} onClick={() => handleGuardClick(guardia)} style={{ 
                minWidth: '200px',
                background: 'white', 
                padding: '15px', 
                borderRadius: '12px', 
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}>
                <div style={{ fontWeight: 'bold', color: '#2d3748', fontSize: '1rem' }}>{guardia.nombre} {guardia.apellido}</div>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '4px' }}>RUT: {guardia.rut}</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px', color: guardia.activo ? '#38a169' : '#e53e3e', fontWeight: 'bold' }}>
                  {guardia.activo ? '● Activo' : '○ Inactivo'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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

      {/* Sección Inferior: Alertas */}
      {/* Sección Inferior: Alertas y Eventos */}
      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Tabla de Últimas Alertas */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxHeight: '500px', overflowY: 'auto' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Últimas Alertas</h3>
          <h3 style={{ marginTop: 0, color: '#e53e3e' }}>Últimas Alertas de Pánico</h3>
          {alerts.length === 0 ? (
            <p style={{ color: '#718096' }}>No hay alertas recientes.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {alerts.map((alert: any, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{ 
                        backgroundColor: '#fed7d7', 
                        color: '#c53030',
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

        {/* Tabla de Eventos (Bitácora) */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxHeight: '500px', overflowY: 'auto' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568' }}>Registro de Eventos</h3>
          {events.length === 0 ? (
            <p style={{ color: '#718096' }}>No hay eventos registrados.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{ 
                        backgroundColor: event.type === 'INCIDENCIA' ? '#fed7d7' : event.type === 'OBSERVACION' ? '#feebc8' : '#bee3f8', 
                        color: event.type === 'INCIDENCIA' ? '#c53030' : event.type === 'OBSERVACION' ? '#c05621' : '#2b6cb0',
                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' 
                      }}>{event.type}</span>
                    </td>
                    <td style={{ padding: '10px 0', color: '#2d3748' }}>
                      <div style={{ fontWeight: 'bold' }}>{event.author}</div>
                      <div style={{ fontSize: '0.85rem' }}>{event.description}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {event.date} {event.timestamp}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Perfil y Rondas del Guardia */}
      {showGuardModal && selectedGuard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <button 
              onClick={closeGuardModal}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#718096'
              }}
            >
              &times;
            </button>

            <h2 style={{ marginTop: 0, color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              Perfil del Guardia
            </h2>
            
            <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#3182ce', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', marginRight: '15px' }}>
                  {selectedGuard.nombre.charAt(0)}{selectedGuard.apellido.charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: '0', color: '#2d3748', fontSize: '1.4rem' }}>{selectedGuard.nombre} {selectedGuard.apellido}</h3>
                  <span style={{ 
                    display: 'inline-block', 
                    marginTop: '5px',
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold', 
                    backgroundColor: selectedGuard.activo ? '#c6f6d5' : '#fed7d7', 
                    color: selectedGuard.activo ? '#2f855a' : '#c53030' 
                  }}>
                    {selectedGuard.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                  <small style={{ color: '#718096', display: 'block', marginBottom: '2px' }}>RUT</small>
                  <span style={{ color: '#2d3748', fontWeight: '500' }}>{selectedGuard.rut}</span>
                </div>
                <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                  <small style={{ color: '#718096', display: 'block', marginBottom: '2px' }}>Teléfono</small>
                  <span style={{ color: '#2d3748', fontWeight: '500' }}>{selectedGuard.telefono || 'No registrado'}</span>
                </div>
                <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #edf2f7', gridColumn: '1 / -1' }}>
                  <small style={{ color: '#718096', display: 'block', marginBottom: '2px' }}>Correo Electrónico</small>
                  <span style={{ color: '#2d3748', fontWeight: '500' }}>{selectedGuard.correo || 'No registrado'}</span>
                </div>
              </div>
            </div>

            <h3 style={{ color: '#4a5568', marginBottom: '15px' }}>Rondas Asignadas</h3>
            
            {guardRounds.length === 0 ? (
              <p style={{ color: '#718096', fontStyle: 'italic', background: '#f7fafc', padding: '15px', borderRadius: '8px' }}>
                No se encontraron rondas registradas para este guardia.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Fecha/Hora</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Ruta</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Estado</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Progreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardRounds.map((ronda: any) => (
                      <React.Fragment key={ronda.id_ronda}>
                        <tr 
                          onClick={() => handleRoundClick(ronda.id_ronda)}
                          style={{ borderBottom: '1px solid #edf2f7', cursor: 'pointer', backgroundColor: expandedRoundId === ronda.id_ronda ? '#f8fafc' : 'transparent' }}
                        >
                          <td style={{ padding: '12px', color: '#2d3748' }}>
                            {ronda.fecha ? new Date(ronda.fecha).toLocaleDateString() : ''} {ronda.hora}
                          </td>
                          <td style={{ padding: '12px', color: '#2d3748', fontWeight: '500' }}>{ronda.nombre_ruta}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              backgroundColor: ronda.estado === 'COMPLETADA' ? '#c6f6d5' : ronda.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
                              color: ronda.estado === 'COMPLETADA' ? '#2f855a' : ronda.estado === 'EN_PROGRESO' ? '#c05621' : '#718096'
                            }}>
                              {ronda.estado}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#4a5568' }}>
                            {ronda.puntos_marcados || 0} / {ronda.total_puntos || '?'} pts
                          </td>
                        </tr>
                        {expandedRoundId === ronda.id_ronda && (
                          <tr>
                            <td colSpan={4} style={{ padding: '15px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Puntos de Control:</p>
                              {loadingPoints ? (
                                <p style={{ fontSize: '0.8rem', color: '#718096' }}>Cargando puntos...</p>
                              ) : roundPoints.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: '#718096' }}>No hay puntos registrados en esta ronda.</p>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                  {roundPoints.map((point: any) => (
                                    <div key={point.id_punto} style={{ 
                                      background: 'white', 
                                      padding: '8px', 
                                      borderRadius: '6px', 
                                      border: `1px solid ${point.marcado ? '#c6f6d5' : '#e2e8f0'}`,
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}>
                                      <div style={{ 
                                        width: '10px', 
                                        height: '10px', 
                                        borderRadius: '50%', 
                                        backgroundColor: point.marcado ? '#38a169' : '#cbd5e0', 
                                        marginRight: '8px' 
                                      }} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: '500', color: point.marcado ? '#2d3748' : '#718096' }}>{point.nombre}</div>
                                        {point.marcado && (
                                          <div style={{ fontSize: '0.7rem', color: '#38a169' }}>
                                            {new Date(point.hora_marcaje).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ color: '#4a5568', marginBottom: '15px', marginTop: '25px' }}>Checks de Presencia</h3>
            
            {guardChecks.length === 0 ? (
              <p style={{ color: '#718096', fontStyle: 'italic', background: '#f7fafc', padding: '15px', borderRadius: '8px' }}>
                No se encontraron checks de presencia recientes.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Fecha/Hora</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Puesto</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Ubicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardChecks.map((check: any) => (
                      <tr key={check.id_presencia} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '12px', color: '#2d3748' }}>
                          {new Date(check.fecha_hora).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', color: '#2d3748' }}>
                          {check.puesto || 'Sin puesto'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <a 
                            href={`https://www.google.com/maps?q=${check.latitud},${check.longitud}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#3182ce', textDecoration: 'none', fontWeight: 'bold' }}
                          >
                            Ver Mapa
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalle y Rondas del Puesto */}
      {showPuestoModal && selectedPuesto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '85vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <button 
              onClick={closePuestoModal}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#718096'
              }}
            >
              &times;
            </button>

            <h2 style={{ marginTop: 0, color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              Detalle del Puesto
            </h2>
            
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#2b6cb0', fontSize: '1.4rem' }}>{selectedPuesto.puesto}</h3>
              <p style={{ margin: '0', color: '#718096' }}><strong>Instalaciones:</strong> {selectedPuesto.instalaciones}</p>
            </div>

            <h3 style={{ color: '#4a5568', marginBottom: '15px' }}>Rondas Asociadas</h3>
            
            {puestoRounds.length === 0 ? (
              <p style={{ color: '#718096', fontStyle: 'italic', background: '#f7fafc', padding: '15px', borderRadius: '8px' }}>
                No se encontraron rondas registradas para este puesto.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Fecha/Hora</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Ruta</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Estado</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Progreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puestoRounds.map((ronda: any) => (
                      <tr key={ronda.id_ronda} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '12px', color: '#2d3748' }}>
                          {ronda.fecha ? new Date(ronda.fecha).toLocaleDateString() : ''} {ronda.hora}
                        </td>
                        <td style={{ padding: '12px', color: '#2d3748', fontWeight: '500' }}>{ronda.nombre_ruta}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            backgroundColor: ronda.estado === 'COMPLETADA' ? '#c6f6d5' : ronda.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
                            color: ronda.estado === 'COMPLETADA' ? '#2f855a' : ronda.estado === 'EN_PROGRESO' ? '#c05621' : '#718096'
                          }}>
                            {ronda.estado}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#4a5568' }}>
                          {ronda.puntos_marcados || 0} / {ronda.total_puntos || '?'} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;