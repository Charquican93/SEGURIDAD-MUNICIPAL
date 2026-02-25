import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

const ShiftPlanning: React.FC = () => {
  const [puestos, setPuestos] = useState<any[]>([]);
  const [guardias, setGuardias] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyRounds, setDailyRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para el formulario de nueva ronda
  const [selectedGuardia, setSelectedGuardia] = useState('');
  const [selectedRuta, setSelectedRuta] = useState('');
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [selectedEndTime, setSelectedEndTime] = useState('09:00');
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [repeatCount, setRepeatCount] = useState(1);
  const [roundDate, setRoundDate] = useState(new Date().toISOString().split('T')[0]);

  // Función auxiliar para asegurar formato HH:mm (24h) con ceros a la izquierda
  const formatTimeForInput = (timeStr: string | null | undefined) => {
    if (!timeStr) return '08:00';
    const [h, m] = timeStr.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargamos Guardias
        try {
          const guardiasRes = await axios.get(`${API_URL}/guardias`);
          setGuardias(guardiasRes.data);
        } catch (error) {
          console.error('Error cargando guardias:', error);
        }

        // Cargamos Puestos (Usamos puestos como rutas/ubicaciones)
        try {
          const puestosRes = await axios.get(`${API_URL}/puestos`);
          setPuestos(puestosRes.data);
        } catch (error) {
          console.error('Error cargando puestos:', error);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Cargar rondas programadas cuando cambia la fecha
  const fetchDailyRounds = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      // Consultamos las rondas existentes para esa fecha
      const response = await axios.get(`${API_URL}/rondas?fecha=${selectedDate}`);
      // Ordenamos por ID descendente para que las últimas agregadas aparezcan primero
      const sortedRounds = Array.isArray(response.data) 
        ? response.data.sort((a: any, b: any) => b.id_ronda - a.id_ronda)
        : [];
      setDailyRounds(sortedRounds);
    } catch (error) {
      console.error('Error fetching rounds for date:', error);
      setDailyRounds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyRounds();
    if (!editingRoundId) {
      setRoundDate(selectedDate);
    }
  }, [selectedDate]);

  const handleAddRound = async () => {
    if (!selectedGuardia || !selectedRuta || !selectedTime) {
      alert('Por favor completa todos los campos (Guardia, Ruta, Hora)');
      return;
    }

    try {
      // Cálculo unificado de tiempos y distribución (funciona para Crear y Editar)
      const startMinutes = parseInt(selectedTime.split(':')[0]) * 60 + parseInt(selectedTime.split(':')[1]);
      const endMinutes = parseInt(selectedEndTime.split(':')[0]) * 60 + parseInt(selectedEndTime.split(':')[1]);
      
      // Calculamos la duración total del bloque de turno
      let totalDuration = endMinutes - startMinutes;
      if (totalDuration < 0) totalDuration += 1440;

      // Calculamos el intervalo proporcional basado en la cantidad
      const calculatedInterval = Math.floor(totalDuration / repeatCount);

      const requests = [];
      
      for (let i = 0; i < repeatCount; i++) {
          const offset = i * calculatedInterval;
          
          // Calcular nuevos tiempos
          const newStartMins = startMinutes + offset;
          const newEndMins = newStartMins + calculatedInterval;
          
          const hStart = Math.floor(newStartMins / 60) % 24;
          const mStart = newStartMins % 60;
          const startTime = `${hStart.toString().padStart(2, '0')}:${mStart.toString().padStart(2, '0')}`;
          
          const hEnd = Math.floor(newEndMins / 60) % 24;
          const mEnd = newEndMins % 60;
          const endTime = `${hEnd.toString().padStart(2, '0')}:${mEnd.toString().padStart(2, '0')}`;

          if (editingRoundId && i === 0) {
            // Si estamos editando, la primera iteración actualiza la ronda existente
            requests.push(axios.put(`${API_URL}/rondas/${editingRoundId}`, {
              id_guardia: selectedGuardia,
              id_puesto: selectedRuta, // Enviamos id_puesto explícitamente
              fecha: roundDate,
              hora: startTime,
              hora_fin: endTime
            }));
          } else {
            // Las demás iteraciones (o todas si es nuevo) crean rondas nuevas
            requests.push(axios.post(`${API_URL}/rondas`, {
                id_guardia: selectedGuardia,
                id_puesto: selectedRuta, // Enviamos id_puesto explícitamente
                fecha: roundDate,
                hora: startTime,
                hora_fin: endTime,
                estado: 'PENDIENTE'
            }));
          }
      }
      
      await Promise.all(requests);
      
      // Recargamos la lista y limpiamos formulario
      fetchDailyRounds();
      // Limpiar campos si estaba editando para evitar confusiones
      if (editingRoundId) handleCancelEdit();
    } catch (error) {
      console.error('Error processing round:', error);
      alert('Error al procesar la ronda.');
    }
  };

  const handleDeleteRound = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta ronda programada?')) return;
    try {
      await axios.delete(`${API_URL}/rondas/${id}`);
      fetchDailyRounds();
    } catch (error) {
      console.error('Error deleting round:', error);
      alert('Error al eliminar la ronda.');
    }
  };

  const handleEditRound = (round: any) => {
    setEditingRoundId(round.id_ronda);
    setSelectedGuardia(round.id_guardia);
    setSelectedRuta(round.id_ruta);
    setSelectedTime(formatTimeForInput(round.hora));
    setSelectedEndTime(formatTimeForInput(round.hora_fin));
    if (round.fecha) setRoundDate(round.fecha.split('T')[0]);
    setRepeatCount(1); // Reiniciar contador al editar
  };

  const handleCancelEdit = () => {
    setEditingRoundId(null);
    setSelectedGuardia('');
    setSelectedRuta('');
    setSelectedTime('08:00');
    setSelectedEndTime('09:00');
    setRepeatCount(1);
    setRoundDate(selectedDate);
  };

  return (
    <Layout title="Programación de Rondas">
      <div style={{ padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#2d3748' }}>
            Programador Diario
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold', color: '#4a5568' }}>Fecha a Planificar:</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', fontWeight: 'bold', color: '#2b6cb0' }}
            />
          </div>
        </div>

        <div style={{ background: '#ebf8ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #3182ce' }}>
          <p style={{ margin: 0, color: '#2c5282', fontSize: '0.9rem' }}>
            <strong>Modo Directo:</strong> Las rondas que agregues aquí se guardarán directamente en la base de datos y aparecerán en la App del guardia para la fecha seleccionada.
          </p>
        </div>

        {/* Formulario de Agregar Ronda */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', marginBottom: '30px', background: editingRoundId ? '#fffaf0' : '#f7fafc', padding: '20px', borderRadius: '8px', border: editingRoundId ? '1px solid #fbd38d' : '1px solid #e2e8f0' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Guardia</label>
            <select 
              value={selectedGuardia} 
              onChange={(e) => setSelectedGuardia(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
            >
              <option value="">-- Seleccionar Guardia --</option>
              {guardias.map((g: any) => (
                <option key={g.id_guardia} value={g.id_guardia}>{g.nombre} {g.apellido}</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Puesto / Ruta</label>
            <select 
              value={selectedRuta} 
              onChange={(e) => setSelectedRuta(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
            >
              <option value="">-- Seleccionar Puesto --</option>
              {puestos.map((p: any) => (
                <option key={p.id_puesto} value={p.id_puesto}>{p.puesto} - {p.instalaciones}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '130px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Fecha</label>
            <input 
              type="date" 
              value={roundDate}
              onChange={(e) => setRoundDate(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
            />
          </div>

          <div style={{ width: '120px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Inicio</label>
            <input 
              type="time" 
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
            />
          </div>

          <div style={{ width: '120px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Término</label>
            <input 
              type="time" 
              value={selectedEndTime}
              onChange={(e) => setSelectedEndTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
            />
          </div>

          <div style={{ width: '100px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Cantidad</label>
            <input 
              type="number" 
              min="1"
              max="24"
              value={repeatCount}
              onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {editingRoundId && (
              <button 
                onClick={handleCancelEdit}
                style={{ padding: '10px 20px', height: '42px', borderRadius: '6px', border: '1px solid #cbd5e0', background: 'white', color: '#4a5568', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            )}
            <button 
              onClick={handleAddRound}
              style={{ padding: '10px 20px', height: '42px', borderRadius: '6px', border: 'none', background: editingRoundId ? '#ed8936' : '#3182ce', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {editingRoundId ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Actualizar</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Agregar</span>
                </>
              )}
            </button>
          </div>
        </div>

        <h3 style={{ color: '#4a5568', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Rondas Programadas ({dailyRounds.length})</h3>

        {loading ? (
          <p style={{ color: '#718096' }}>Cargando datos...</p>
        ) : dailyRounds.length === 0 ? (
          <p style={{ color: '#718096', fontStyle: 'italic', padding: '20px', textAlign: 'center', background: '#f7fafc', borderRadius: '8px' }}>
            No hay rondas programadas para este día.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px', color: '#4a5568' }}>Horario</th>
                <th style={{ padding: '12px', color: '#4a5568' }}>Ruta</th>
                <th style={{ padding: '12px', color: '#4a5568' }}>Guardia</th>
                <th style={{ padding: '12px', color: '#4a5568' }}>Estado</th>
                <th style={{ padding: '12px', color: '#4a5568', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {dailyRounds.map((round: any) => (
                <tr key={round.id_ronda} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#2d3748' }}>
                    {formatTimeForInput(round.hora)} 
                    {round.hora_fin ? ` - ${formatTimeForInput(round.hora_fin)}` : ''}
                  </td>
                  <td style={{ padding: '12px', color: '#2d3748' }}>{round.nombre_ruta || 'Ruta ' + round.id_ruta}</td>
                  <td style={{ padding: '12px', color: '#2d3748' }}>
                    {round.nombre_guardia ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3182ce', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {round.nombre_guardia.charAt(0)}{round.apellido_guardia ? round.apellido_guardia.charAt(0) : ''}
                        </div>
                        <span>{round.nombre_guardia} {round.apellido_guardia}</span>
                      </div>
                    ) : <span style={{color: '#cbd5e0', fontStyle: 'italic'}}>Sin asignar</span>}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                      backgroundColor: round.estado === 'COMPLETADA' ? '#c6f6d5' : round.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
                      color: round.estado === 'COMPLETADA' ? '#2f855a' : round.estado === 'EN_PROGRESO' ? '#c05621' : '#718096'
                    }}>
                      {round.estado}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleEditRound(round)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3182ce', marginRight: '10px' }}
                      title="Editar Ronda"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDeleteRound(round.id_ronda)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e' }}
                      title="Eliminar Ronda"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export default ShiftPlanning;