import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    activeGuards: 0,
    alerts: 0,
    rounds: {
      daily: { total: 0, completed: 0 },
      weekly: { total: 0, completed: 0 },
      monthly: { total: 0, completed: 0 }
    }
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
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [guardMessages, setGuardMessages] = useState<any[]>([]);
  const [showRoundsModal, setShowRoundsModal] = useState(false);
  const [todaysRounds, setTodaysRounds] = useState<any[]>([]);
  const [guardFilter, setGuardFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [roundsPeriod, setRoundsPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

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

  const handleGuardClick = async (guard: any) => {
    setSelectedGuard(guard);
    setShowGuardModal(true);
    setGuardRounds([]); // Limpiar anteriores
    setGuardChecks([]); // Limpiar anteriores
    setExpandedRoundId(null); // Resetear ronda expandida
    setRoundPoints([]);
    setGuardMessages([]); // Limpiar mensajes anteriores
    setMessageTitle('');
    setMessageBody('');
    try {
      const [detailsRes, roundsRes, checksRes, messagesRes] = await Promise.all([
        axios.get(`${API_URL}/guardias/${guard.id_guardia}`),
        axios.get(`${API_URL}/rondas?id_guardia=${guard.id_guardia}`),
        axios.get(`${API_URL}/checks?id_guardia=${guard.id_guardia}`),
        axios.get(`${API_URL}/mensajes?id_guardia=${guard.id_guardia}`)
      ]);
      setSelectedGuard(detailsRes.data);
      setGuardRounds(roundsRes.data);
      setGuardChecks(checksRes.data);
      setGuardMessages(messagesRes.data);
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

  const handleSendMessage = async () => {
    if (!messageTitle.trim() || !messageBody.trim() || !selectedGuard) return;
    
    setSendingMessage(true);
    try {
      await axios.post(`${API_URL}/mensajes`, {
        id_guardia: selectedGuard.id_guardia,
        titulo: messageTitle,
        contenido: messageBody
      });
      alert('Mensaje enviado correctamente');
      setMessageTitle('');
      setMessageBody('');
      
      // Recargar la lista de mensajes para ver el nuevo
      const msgsRes = await axios.get(`${API_URL}/mensajes?id_guardia=${selectedGuard.id_guardia}`);
      setGuardMessages(msgsRes.data);

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleRoundsStatsClick = async () => {
    setShowRoundsModal(true);
    setTodaysRounds([]);
    try {
      // Mapeamos el periodo seleccionado al parámetro que espera el backend
      let periodParam = 'hoy';
      if (roundsPeriod === 'weekly') periodParam = 'semana';
      if (roundsPeriod === 'monthly') periodParam = 'mes';

      const response = await axios.get(`${API_URL}/rondas?periodo=${periodParam}`);
      setTodaysRounds(response.data);
    } catch (error) {
      console.error('Error fetching todays rounds:', error);
    }
  };

  // Calcular porcentaje actual basado en el periodo seleccionado
  const currentStats = stats.rounds[roundsPeriod] || { total: 0, completed: 0 };
  const currentProgress = currentStats.total > 0 
    ? Math.round((currentStats.completed / currentStats.total) * 100) 
    : 0;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#4a5568' }}>Guardias Registrados</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setGuardFilter(guardFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: guardFilter === 'ACTIVE' ? '#38a169' : '#e2e8f0',
                color: guardFilter === 'ACTIVE' ? 'white' : '#4a5568',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              Activos
            </button>
            <button
              onClick={() => setGuardFilter(guardFilter === 'INACTIVE' ? 'ALL' : 'INACTIVE')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: guardFilter === 'INACTIVE' ? '#e53e3e' : '#e2e8f0',
                color: guardFilter === 'INACTIVE' ? 'white' : '#4a5568',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              No Activos
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
          {guardias.filter((g: any) => {
            if (guardFilter === 'ACTIVE') return g.activo;
            if (guardFilter === 'INACTIVE') return !g.activo;
            return true;
          }).length === 0 ? (
            <div style={{ padding: '15px', background: 'white', borderRadius: '8px', color: '#718096' }}>
              No hay guardias {guardFilter === 'ACTIVE' ? 'activos' : guardFilter === 'INACTIVE' ? 'inactivos' : 'registrados'}.
            </div>
          ) : (
            guardias.filter((g: any) => {
              if (guardFilter === 'ACTIVE') return g.activo;
              if (guardFilter === 'INACTIVE') return !g.activo;
              return true;
            }).map((guardia: any) => (
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
        <div 
          onClick={handleRoundsStatsClick}
          style={{ 
            background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            cursor: 'pointer', transition: 'transform 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <h3 style={{ marginTop: 0, color: '#4a5568' }}>Rondas Completadas</h3>
            <select 
              onClick={(e) => e.stopPropagation()} 
              value={roundsPeriod}
              onChange={(e) => setRoundsPeriod(e.target.value as any)}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '0.8rem', color: '#4a5568', outline: 'none', cursor: 'pointer', background: '#f7fafc' }}
            >
              <option value="daily">Hoy</option>
              <option value="weekly">Semana</option>
              <option value="monthly">Mes</option>
            </select>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0', color: '#38a169' }}>{currentProgress}%</p>
          <small style={{ color: '#718096' }}>{currentStats.completed} de {currentStats.total} programadas</small>
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
                      {new Date(alert.fecha_hora).toDateString() === new Date().toDateString() && (
                        <span style={{ 
                          backgroundColor: '#e53e3e', 
                          color: 'white',
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          marginLeft: '8px',
                          boxShadow: '0 2px 4px rgba(229, 62, 62, 0.4)'
                        }}>HOY!</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 0', color: '#2d3748' }}>
                      <div style={{ fontWeight: 'bold' }}>{alert.nombre} {alert.apellido}</div>
                      <div style={{ fontSize: '0.85rem' }}>{alert.descripcion}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span>{new Date(alert.fecha_hora).toLocaleString()}</span>
                        {alert.latitud && alert.longitud && (
                          <a 
                            href={`https://www.google.com/maps?q=${alert.latitud},${alert.longitud}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#e53e3e', fontWeight: 'bold', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            📍 Ver Ubicación
                          </a>
                        )}
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

            {/* Sección de Envío de Mensajes */}
            <div style={{ marginBottom: '25px', background: '#ebf8ff', padding: '20px', borderRadius: '12px', border: '1px solid #bee3f8' }}>
              <h3 style={{ marginTop: 0, color: '#2b6cb0', marginBottom: '10px' }}>Enviar Mensaje al Guardia</h3>
              <input 
                type="text" 
                placeholder="Asunto / Título"
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }}
              />
              <textarea 
                placeholder="Escribe tu mensaje aquí..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', minHeight: '80px', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <button 
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageTitle || !messageBody}
                style={{ background: '#3182ce', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: sendingMessage ? 0.7 : 1 }}
              >
                {sendingMessage ? 'Enviando...' : 'Enviar Mensaje'}
              </button>
            </div>

            <h3 style={{ color: '#4a5568', marginBottom: '15px' }}>Historial de Mensajes</h3>
            {guardMessages.length === 0 ? (
              <p style={{ color: '#718096', fontStyle: 'italic', marginBottom: '25px', background: '#f7fafc', padding: '10px', borderRadius: '8px' }}>
                No hay mensajes enviados a este guardia.
              </p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '25px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f7fafc' }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#4a5568' }}>Fecha</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#4a5568' }}>Título</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#4a5568' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardMessages.map((msg: any) => (
                      <tr key={msg.id_mensaje} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '10px', color: '#4a5568' }}>{new Date(msg.fecha_hora).toLocaleString()}</td>
                        <td style={{ padding: '10px', color: '#2d3748', fontWeight: '500' }}>{msg.titulo}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: msg.leido ? '#c6f6d5' : '#feebc8',
                            color: msg.leido ? '#2f855a' : '#c05621'
                          }}>
                            {msg.leido ? 'LEÍDO' : 'NO LEÍDO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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

      {/* Modal de Detalle de Rondas del Día */}
      {showRoundsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '900px',
            maxHeight: '85vh', overflowY: 'auto', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <button 
              onClick={() => setShowRoundsModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#718096' }}
            >
              &times;
            </button>

            <h2 style={{ marginTop: 0, color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              Detalle de Rondas ({roundsPeriod === 'daily' ? 'Hoy' : roundsPeriod === 'weekly' ? 'Última Semana' : 'Último Mes'})
            </h2>

            {todaysRounds.length === 0 ? (
              <p style={{ color: '#718096', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No hay rondas registradas para este periodo.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Hora</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Ruta</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Guardia Asignado</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>Estado</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>Progreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysRounds.map((ronda: any) => (
                      <tr key={ronda.id_ronda} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '12px', color: '#2d3748', fontWeight: 'bold' }}>
                          {ronda.hora ? ronda.hora.substring(0, 5) : '--:--'}
                        </td>
                        <td style={{ padding: '12px', color: '#2d3748' }}>
                          {ronda.nombre_ruta}
                        </td>
                        <td style={{ padding: '12px', color: '#2d3748' }}>
                          {ronda.nombre_guardia ? `${ronda.nombre_guardia} ${ronda.apellido_guardia}` : <span style={{color: '#cbd5e0'}}>Sin asignar</span>}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                            backgroundColor: ronda.estado === 'COMPLETADA' ? '#c6f6d5' : ronda.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
                            color: ronda.estado === 'COMPLETADA' ? '#2f855a' : ronda.estado === 'EN_PROGRESO' ? '#c05621' : '#718096'
                          }}>
                            {ronda.estado}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#4a5568' }}>
                          {ronda.puntos_marcados || 0} / {ronda.total_puntos || '?'}
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