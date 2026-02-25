import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

const History: React.FC = () => {
  const [rounds, setRounds] = useState<any[]>([]);
  const [period, setPeriod] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [loading, setLoading] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
  const [roundPoints, setRoundPoints] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  const fetchRounds = async () => {
    setLoading(true);
    setRounds([]);
    setExpandedRoundId(null);
    try {
      // Consultamos con los filtros seleccionados
      const response = await axios.get(`${API_URL}/rondas?periodo=${period}&estado=${statusFilter}`);
      setRounds(response.data);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, [period, statusFilter]);

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

  // Estilos para los botones de filtro
  const getButtonStyle = (isActive: boolean) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    border: isActive ? 'none' : '1px solid #e2e8f0',
    backgroundColor: isActive ? '#3182ce' : 'white',
    color: isActive ? 'white' : '#4a5568',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: isActive ? 'bold' : 'normal',
    transition: 'all 0.2s',
    outline: 'none'
  });

  return (
    <Layout title="Historial de Rondas">
      <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        
        {/* Encabezado y Filtros */}
        <div style={{ marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2d3748' }}>Histórico de rondas</h2>
            <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '0.9rem' }}>Registro histórico de todas las rondas y sus puntos de control correspondientes</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Grupo 1: Periodo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#718096', marginRight: '5px' }}>Periodo:</span>
              {[
                { label: 'Hoy', value: 'hoy' },
                { label: 'Ayer', value: 'ayer' },
                { label: 'Última Semana', value: 'semana' },
                { label: 'Último Mes', value: 'mes' },
                { label: 'Todos', value: 'todos' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  style={getButtonStyle(period === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Grupo 2: Estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#718096', marginRight: '12px' }}>Estado:</span>
              {['TODAS', 'COMPLETADA', 'EN_PROGRESO', 'PENDIENTE'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={getButtonStyle(statusFilter === st)}
                >
                  {st === 'TODAS' ? 'Todas' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla de Resultados */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#718096' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Cargando historial...</div>
          </div>
        ) : rounds.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: '#f7fafc', borderRadius: '8px', color: '#718096', border: '1px dashed #cbd5e0' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>📅</div>
            No se encontraron rondas con los filtros seleccionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568', fontWeight: '600' }}>Fecha</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568', fontWeight: '600' }}>Hora</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568', fontWeight: '600' }}>Ruta / Ubicación</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568', fontWeight: '600' }}>Guardia Asignado</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#4a5568', fontWeight: '600' }}>Estado</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#4a5568', fontWeight: '600' }}>Progreso</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#4a5568', fontWeight: '600' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((ronda) => (
                  <React.Fragment key={ronda.id_ronda}>
                    <tr 
                      style={{ 
                        borderBottom: '1px solid #edf2f7', 
                        backgroundColor: expandedRoundId === ronda.id_ronda ? '#ebf8ff' : 'transparent', 
                        transition: 'background 0.2s' 
                      }}
                    >
                      <td style={{ padding: '15px', color: '#2d3748' }}>
                        {ronda.fecha ? new Date(ronda.fecha).toLocaleDateString() : ''}
                      </td>
                      <td style={{ padding: '15px', color: '#2d3748', fontWeight: 'bold' }}>
                        {ronda.hora ? ronda.hora.substring(0, 5) : '--:--'} {ronda.hora_fin ? `- ${ronda.hora_fin.substring(0, 5)}` : ''}
                      </td>
                      <td style={{ padding: '15px', color: '#2d3748' }}>
                        {ronda.nombre_ruta}
                      </td>
                      <td style={{ padding: '15px', color: '#2d3748' }}>
                        {ronda.nombre_guardia ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3182ce', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {ronda.nombre_guardia.charAt(0)}{ronda.apellido_guardia.charAt(0)}
                            </div>
                            <span>{ronda.nombre_guardia} {ronda.apellido_guardia}</span>
                          </div>
                        ) : <span style={{color: '#cbd5e0', fontStyle: 'italic'}}>Sin asignar</span>}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          backgroundColor: ronda.estado === 'COMPLETADA' ? '#c6f6d5' : ronda.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
                          color: ronda.estado === 'COMPLETADA' ? '#2f855a' : ronda.estado === 'EN_PROGRESO' ? '#c05621' : '#718096',
                          display: 'inline-block',
                          minWidth: '110px',
                          textAlign: 'center'
                        }}>
                          {ronda.estado}
                        </span>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center', color: '#4a5568', fontWeight: '500' }}>
                        {ronda.puntos_marcados || 0} / {ronda.total_puntos || '?'}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleRoundClick(ronda.id_ronda)}
                          style={{ 
                            background: 'white', 
                            border: '1px solid #3182ce', 
                            color: '#3182ce', 
                            cursor: 'pointer', 
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {expandedRoundId === ronda.id_ronda ? 'Ocultar' : 'Ver Detalle'}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Fila de Detalles Expandible */}
                    {expandedRoundId === ronda.id_ronda && (
                      <tr>
                        <td colSpan={7} style={{ padding: '20px', backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 15px 0', color: '#4a5568', fontSize: '1rem' }}>📍 Puntos de Control de la Ronda</h4>
                          {loadingPoints ? (
                            <div style={{ color: '#718096', fontStyle: 'italic', padding: '10px' }}>Cargando detalles...</div>
                          ) : roundPoints.length === 0 ? (
                            <div style={{ color: '#718096', fontStyle: 'italic', padding: '10px' }}>No hay puntos registrados en esta ruta.</div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                              {roundPoints.map((point: any, index: number) => {
                                // Cálculo de Hora Ideal
                                let idealTimeStr = "";
                                let isLate = false;
                                let isEarly = false;
                                if (ronda.hora) {
                                  const [h, m] = ronda.hora.split(':').map(Number);
                                  const startMins = h * 60 + m;
                                  let duration = 60;
                                  if (ronda.hora_fin) {
                                    const [hE, mE] = ronda.hora_fin.split(':').map(Number);
                                    let endMins = hE * 60 + mE;
                                    duration = endMins - startMins;
                                    if (duration < 0) duration += 1440;
                                  }
                                  const total = ronda.total_puntos || roundPoints.length || 1;
                                  const interval = duration / total;
                                  const pointTime = startMins + (index * interval);
                                  const pH = Math.floor(pointTime / 60) % 24;
                                  const pM = Math.floor(pointTime % 60);
                                  idealTimeStr = `${pH.toString().padStart(2, '0')}:${pM.toString().padStart(2, '0')}`;

                                  if (point.marcado && point.hora_marcaje) {
                                    const markedDate = new Date(point.hora_marcaje);
                                    const markedMins = markedDate.getHours() * 60 + markedDate.getMinutes();
                                    const diff = markedMins - (pH * 60 + pM);
                                    if (diff > 10) isLate = true;
                                    else if (diff < -10) isEarly = true;
                                  }
                                }

                                return (
                                  <div key={point.id_punto} style={{ 
                                    background: 'white', 
                                    padding: '15px', 
                                    borderRadius: '8px', 
                                    borderLeft: `4px solid ${point.marcado ? (isLate ? '#e53e3e' : isEarly ? '#3182ce' : '#38a169') : '#cbd5e0'}`,
                                    borderTop: '1px solid #e2e8f0',
                                    borderRight: '1px solid #e2e8f0',
                                    borderBottom: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                  }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: point.marcado ? '#2d3748' : '#718096' }}>{point.nombre}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: 'bold' }}>Ideal: {idealTimeStr}</div>
                                      </div>
                                      {point.marcado ? (
                                        <div>
                                          <div style={{ fontSize: '0.8rem', color: isLate ? '#e53e3e' : isEarly ? '#3182ce' : '#38a169', marginTop: '4px', fontWeight: '500' }}>
                                            ✓ Marcado a las {new Date(point.hora_marcaje).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            {isLate && ' (Atrasado)'}
                                            {isEarly && ' (Anticipado)'}
                                          </div>
                                          {/* Indicador de Distancia GPS */}
                                          {point.estado_gps && (
                                            <div style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                                              {point.estado_gps === 'OK' && (
                                                <span style={{ backgroundColor: '#f0fff4', color: '#2f855a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #c6f6d5' }}>
                                                  📍 En rango ({point.distancia}m)
                                                </span>
                                              )}
                                              {point.estado_gps === 'FUERA_RANGO' && (
                                                <span style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fed7d7', fontWeight: 'bold' }}>
                                                  ⚠️ Fuera de rango ({point.distancia}m)
                                                </span>
                                              )}
                                              {point.estado_gps === 'SIN_GPS' && (
                                                <span style={{ backgroundColor: '#edf2f7', color: '#718096', padding: '2px 6px', borderRadius: '4px' }}>
                                                  📡 Sin GPS
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: '0.8rem', color: '#a0aec0', marginTop: '4px' }}>Pendiente</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
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
      </div>
    </Layout>
  );
};

export default History;