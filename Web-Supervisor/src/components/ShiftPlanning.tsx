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

  const [guardSearch, setGuardSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

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
    setDailyRounds([]); // Limpiar rondas anteriores para evitar chequeos con datos viejos
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
      // Limpiar campos siempre para evitar que aparezca la alerta de "Turno Extra" con el guardia recién agregado
      handleCancelEdit();
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

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      // Si el estado no está definido, asumimos que está colapsado (true), por lo que el primer toggle lo expande (false)
      [groupId]: !(prev[groupId] ?? true)
    }));
  };

  // Estilos para un formulario más moderno y limpio
  const formStyles: { [key: string]: React.CSSProperties } = {
    formGroup: {
      flex: '1 1 200px',
      minWidth: '180px',
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontSize: '0.75rem',
      fontWeight: 'bold',
      color: '#2b6cb0',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    button: {
      padding: '10px 20px',
      height: '42px',
      borderRadius: '8px',
      border: 'none',
      color: 'white',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    },
  };

  const filteredRounds = dailyRounds.filter((round: any) => {
    if (!guardSearch) return true;
    const fullName = `${round.nombre_guardia || ''} ${round.apellido_guardia || ''}`.toLowerCase();
    return fullName.includes(guardSearch.toLowerCase());
  });

  // Detectar si es un Turno Extra (El guardia ya tiene rondas ese día y estamos agregando, no editando)
  const isExtraShift = React.useMemo(() => {
    return !editingRoundId && selectedGuardia && dailyRounds.some((r: any) => String(r.id_guardia) === String(selectedGuardia));
  }, [selectedGuardia, dailyRounds, editingRoundId]);

  // Agrupar rondas por guardia
  const groupedRounds = filteredRounds.reduce((acc: any, round: any) => {
    const guardId = round.id_guardia || 'unassigned';
    if (!acc[guardId]) {
      acc[guardId] = {
        id: guardId,
        name: round.nombre_guardia ? `${round.nombre_guardia} ${round.apellido_guardia}` : 'Sin Asignar',
        rounds: []
      };
    }
    acc[guardId].rounds.push(round);
    return acc;
  }, {});

  // Ordenar grupos: Primero los asignados (alfabéticamente), al final los sin asignar
  const sortedGroups = Object.values(groupedRounds).sort((a: any, b: any) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      return a.name.localeCompare(b.name);
  });

  return (
    <Layout title="Programación de Rondas">
      <style>{`
        .modern-input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e0;
          background-color: white;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .modern-input:focus {
          border-color: #2b6cb0;
          box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.15);
        }
      `}</style>
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

        {/* Advertencia de Turno Extra */}
        {isExtraShift && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff5f5', borderLeft: '4px solid #e53e3e', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '12px', boxShadow: '0 2px 4px rgba(229, 62, 62, 0.1)' }}>
             <div style={{ color: '#e53e3e', marginTop: '2px' }}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
             </div>
             <div>
               <div style={{ fontWeight: 'bold', color: '#c53030', fontSize: '0.95rem', marginBottom: '2px' }}>¡Atención! Turno Extra Detectado</div>
               <div style={{ color: '#e53e3e', fontSize: '0.85rem', lineHeight: '1.4' }}>El guardia seleccionado <strong>ya tiene rondas asignadas</strong> para este día. <br/>Esta acción agregará una nueva serie de rondas que se considerarán como un <strong>Turno Adicional</strong>.</div>
             </div>
          </div>
        )}

        {/* Formulario de Agregar Ronda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end', marginBottom: '30px', background: editingRoundId ? '#fffaf0' : (isExtraShift ? '#fff5f5' : '#f7fafc'), padding: '25px', borderRadius: '12px', border: editingRoundId ? '1px solid #fbd38d' : (isExtraShift ? '1px solid #feb2b2' : '1px solid #e2e8f0'), transition: 'all 0.3s ease' }}>
          <div style={formStyles.formGroup}>
            <label style={formStyles.label}>Guardia</label>
            <select 
              value={selectedGuardia} 
              onChange={(e) => setSelectedGuardia(e.target.value)}
              className="modern-input"
            >
              <option value="">-- Seleccionar Guardia --</option>
              {guardias.map((g: any) => (
                <option key={g.id_guardia} value={g.id_guardia}>{g.nombre} {g.apellido}</option>
              ))}
            </select>
          </div>
          
          <div style={formStyles.formGroup}>
            <label style={formStyles.label}>Puesto / Ruta</label>
            <select 
              value={selectedRuta} 
              onChange={(e) => setSelectedRuta(e.target.value)}
              className="modern-input"
            >
              <option value="">-- Seleccionar Puesto --</option>
              {puestos.map((p: any) => (
                <option key={p.id_puesto} value={p.id_puesto}>{p.puesto} - {p.instalaciones}</option>
              ))}
            </select>
          </div>

          <div style={{ ...formStyles.formGroup, flexGrow: 0.5 }}>
            <label style={formStyles.label}>Fecha</label>
            <input 
              type="date" 
              value={roundDate}
              onChange={(e) => setRoundDate(e.target.value)}
              className="modern-input"
            />
          </div>

          <div style={{ ...formStyles.formGroup, flexGrow: 0.5 }}>
            <label style={formStyles.label}>Inicio de Turno</label>
            <input 
              type="time" 
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="modern-input"
            />
          </div>

          <div style={{ ...formStyles.formGroup, flexGrow: 0.5 }}>
            <label style={formStyles.label}>Término de Turno</label>
            <input 
              type="time" 
              value={selectedEndTime}
              onChange={(e) => setSelectedEndTime(e.target.value)}
              className="modern-input"
            />
          </div>

          <div style={{ ...formStyles.formGroup, flex: '0 1 120px', minWidth: '100px' }}>
            <label style={formStyles.label}>Nº Rondas</label>
            <input 
              type="number" 
              min="1"
              max="24"
              value={repeatCount}
              onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
              className="modern-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
            {editingRoundId && (
              <button 
                onClick={handleCancelEdit}
                style={{ ...formStyles.button, background: 'white', color: '#4a5568', border: '1px solid #cbd5e0' }}
              >
                Cancelar
              </button>
            )}
            <button 
              onClick={handleAddRound}
              style={{ ...formStyles.button, background: editingRoundId ? '#ed8936' : (isExtraShift ? '#e53e3e' : '#3182ce'), boxShadow: isExtraShift ? '0 4px 6px rgba(229, 62, 62, 0.2)' : 'none' }}
            >
              {editingRoundId ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Actualizar Ronda</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{isExtraShift ? 'Confirmar Turno Extra' : 'Agregar Ronda'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <h3 style={{ color: '#4a5568', margin: 0 }}>Rondas Programadas ({filteredRounds.length})</h3>
          <input
            type="text"
            placeholder="Buscar por nombre de guardia..."
            value={guardSearch}
            onChange={(e) => setGuardSearch(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '6px', 
              border: '1px solid #cbd5e0', 
              width: '250px' 
            }}
          />
        </div>

        {loading ? (
          <p style={{ color: '#718096' }}>Cargando datos...</p>
        ) : filteredRounds.length === 0 ? (
          <p style={{ color: '#718096', fontStyle: 'italic', padding: '20px', textAlign: 'center', background: '#f7fafc', borderRadius: '8px' }}>
            {guardSearch ? 'No se encontraron rondas para su búsqueda.' : 'No hay rondas programadas para este día.'}
          </p>
        ) : (
          <div style={{ marginTop: '20px' }}>
            {sortedGroups.map((group: any) => {
              // Por defecto, los grupos están colapsados (true) si no tienen un estado explícito
              const isCollapsed = collapsedGroups[group.id] ?? true;
              
              // Lógica de detección de turnos (Normal vs Extra)
              let isDoubleShift = false;
              const roundShiftMap = new Map<string, number>();

              if (group.id !== 'unassigned' && group.rounds.length > 0) {
                 // Ordenamos cronológicamente para determinar la secuencia de turnos
                 const sorted = [...group.rounds].sort((a: any, b: any) => a.hora.localeCompare(b.hora));
                 let currentShift = 0;
                 roundShiftMap.set(String(sorted[0].id_ronda), 0);

                 for (let i = 1; i < sorted.length; i++) {
                    const prev = sorted[i-1];
                    const curr = sorted[i];
                    let isNewShift = false;

                    // Criterio 1: Cambio de Ruta/Puesto
                    if (String(curr.id_ruta) !== String(prev.id_ruta)) isNewShift = true;
                    
                    // Criterio 2: Brecha de tiempo > 60 minutos (Reducido para mejor detección)
                    if (prev.hora_fin && curr.hora) {
                        const [h1, m1] = prev.hora_fin.split(':').map(Number);
                        const [h2, m2] = curr.hora.split(':').map(Number);
                        let diffInMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
                        
                        // Si la diferencia es negativa, asumimos que cruzó la medianoche
                        if (diffInMinutes < 0) diffInMinutes += 1440; // 24 * 60 minutos

                        if (diffInMinutes > 30) isNewShift = true; // Umbral de 30 minutos para considerarse turno nuevo
                    }
                    
                    if (isNewShift) currentShift++;
                    roundShiftMap.set(String(curr.id_ronda), currentShift);
                 }
                 
                 if (currentShift > 0) isDoubleShift = true;
              }

              return (
              <div key={group.id} style={{ marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div 
                  onClick={() => toggleGroup(group.id)}
                  style={{ padding: '12px 15px', background: '#f7fafc', borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: group.id === 'unassigned' ? '#cbd5e0' : '#3182ce', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {group.id === 'unassigned' ? '?' : group.name.charAt(0)}
                      </div>
                      <div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 'bold', color: '#2d3748', fontSize: '0.95rem' }}>{group.name}</div>
                            {isDoubleShift && (
                                <span style={{ 
                                    backgroundColor: '#fed7d7', color: '#c53030', 
                                    fontSize: '0.65rem', fontWeight: 'bold', 
                                    padding: '2px 6px', borderRadius: '10px', 
                                    border: '1px solid #feb2b2', textTransform: 'uppercase' 
                                }}>
                                    Turno Extra
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>{group.rounds.length} ronda(s) asignada(s)</div>
                      </div>
                   </div>
                   <div style={{ color: '#718096' }}>
                      {isCollapsed ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                      )}
                   </div>
                </div>
                {!isCollapsed && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: 'white', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 15px', color: '#718096', fontSize: '0.75rem', textTransform: 'uppercase', width: '20%' }}>Horario</th>
                      <th style={{ padding: '10px 15px', color: '#718096', fontSize: '0.75rem', textTransform: 'uppercase', width: '40%' }}>Ruta</th>
                      <th style={{ padding: '10px 15px', color: '#718096', fontSize: '0.75rem', textTransform: 'uppercase', width: '20%' }}>Estado</th>
                      <th style={{ padding: '10px 15px', color: '#718096', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', width: '20%' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rounds
                      .sort((a: any, b: any) => a.hora.localeCompare(b.hora))
                      .map((round: any) => {
                      const isExtra = (roundShiftMap.get(String(round.id_ronda)) || 0) > 0;
                      return (
                      <tr key={round.id_ronda} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#2d3748' }}>
                          {formatTimeForInput(round.hora)} 
                          {round.hora_fin ? ` - ${formatTimeForInput(round.hora_fin)}` : ''}
                          {isExtra && (
                            <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '0.65rem', 
                                backgroundColor: '#fed7d7', 
                                color: '#c53030', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                border: '1px solid #feb2b2'
                            }}>
                                Extra
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 15px', color: '#2d3748' }}>{round.nombre_ruta || 'Ruta ' + round.id_ruta}</td>
                        <td style={{ padding: '10px 15px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold',
                            backgroundColor: round.estado === 'COMPLETADA' ? '#c6f6d5' : round.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
                            color: round.estado === 'COMPLETADA' ? '#2f855a' : round.estado === 'EN_PROGRESO' ? '#c05621' : '#718096'
                          }}>
                            {round.estado}
                          </span>
                        </td>
                        <td style={{ padding: '10px 15px', textAlign: 'right' }}>
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
                      );
                    })}
                  </tbody>
                </table>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ShiftPlanning;