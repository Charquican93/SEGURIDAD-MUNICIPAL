import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

const ShiftHistory: React.FC = () => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [guardFilter, setGuardFilter] = useState('');

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const params: any = {
        estado: statusFilter,
        search: guardFilter
      };

      // Calcular fechas en el cliente (navegador) para evitar desajustes de zona horaria con Railway (UTC)
      const now = new Date();
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (period === 'hoy') {
        params.fecha_inicio = formatDate(now);
        params.fecha_fin = formatDate(now);
      } else if (period === 'ayer') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        params.fecha_inicio = formatDate(yesterday);
        params.fecha_fin = formatDate(yesterday);
      } else if (period === 'semana') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.fecha_inicio = formatDate(weekAgo);
        params.fecha_fin = formatDate(now);
      } else if (period === 'mes') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        params.fecha_inicio = formatDate(monthAgo);
        params.fecha_fin = formatDate(now);
      } else {
        params.periodo = period; // 'todos'
      }

      const response = await axios.get(`${API_URL}/turnos`, {
        params
      });
      if (Array.isArray(response.data)) {
        setShifts(response.data);
      } else {
        setShifts([]);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [period, statusFilter]); // Recargar al cambiar filtros

  // Función para calcular y renderizar el estado del inicio de turno
  const renderStartStatus = (shift: any) => {
    if (!shift.hora_inicio || !shift.hora_programada) return null;

    const [hReal, mReal] = String(shift.hora_inicio).split(':').map(Number);
    const [hProg, mProg] = String(shift.hora_programada).split(':').map(Number);
    
    const realMins = hReal * 60 + mReal;
    const progMins = hProg * 60 + mProg;
    const diff = realMins - progMins;

    if (diff > 10) {
      return (
        <span style={{ backgroundColor: '#fed7d7', color: '#c53030', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>
          Atrasado (+{diff} min)
        </span>
      );
    } else if (diff < -10) {
      return (
        <span style={{ backgroundColor: '#bee3f8', color: '#2b6cb0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>
          Anticipado ({diff} min)
        </span>
      );
    }
    return (
      <span style={{ backgroundColor: '#c6f6d5', color: '#2f855a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>
        A tiempo
      </span>
    );
  };

  // Función para calcular y renderizar el estado del fin de turno
  const renderEndStatus = (shift: any) => {
    if (!shift.hora_fin || !shift.hora_fin_programada) return null;

    const [hReal, mReal] = String(shift.hora_fin).split(':').map(Number);
    const [hProg, mProg] = String(shift.hora_fin_programada).split(':').map(Number);
    
    const realMins = hReal * 60 + mReal;
    const progMins = hProg * 60 + mProg;
    const diff = realMins - progMins;

    if (diff < -10) {
      return (
        <span style={{ backgroundColor: '#fed7d7', color: '#c53030', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>
          Anticipado ({diff} min)
        </span>
      );
    } else if (diff > 10) {
      return (
        <span style={{ backgroundColor: '#bee3f8', color: '#2b6cb0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>
          Salida Tarde (+{diff} min)
        </span>
      );
    }
    return (
      <span style={{ backgroundColor: '#c6f6d5', color: '#2f855a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>
        A tiempo
      </span>
    );
  };

  // Función para renderizar el cumplimiento de rondas
  const renderCompliance = (shift: any) => {
    const total = shift.rondas_totales || 0;
    const completed = shift.rondas_completadas || 0;
    
    // Si el turno está cerrado (tiene hora_fin) y no completó todas las rondas
    if (shift.hora_fin && completed < total) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>{completed} / {total}</span>
          <span style={{ fontSize: '0.7rem', color: '#c53030', backgroundColor: '#fed7d7', padding: '2px 6px', borderRadius: '4px', marginTop: '2px' }}>
            INCOMPLETO
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ color: completed >= total && total > 0 ? '#38a169' : '#4a5568', fontWeight: 'bold' }}>
          {completed} / {total}
        </span>
        {completed >= total && total > 0 && (
          <span style={{ fontSize: '0.7rem', color: '#2f855a', backgroundColor: '#c6f6d5', padding: '2px 6px', borderRadius: '4px', marginTop: '2px' }}>
            CUMPLIDO
          </span>
        )}
      </div>
    );
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
    <Layout title="Historial de Turnos">
      <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        
        {/* Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
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
              <button key={opt.value} onClick={() => setPeriod(opt.value)} style={getButtonStyle(period === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Grupo 2: Estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#718096', marginRight: '5px' }}>Estado:</span>
              {['TODOS', 'ACTIVO', 'CERRADO'].map((st) => (
                <button key={st} onClick={() => setStatusFilter(st)} style={getButtonStyle(statusFilter === st)}>
                  {st === 'TODOS' ? 'Todos' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div style={{ flex: 1, minWidth: '250px', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o RUT..." 
                  value={guardFilter}
                  onChange={(e) => setGuardFilter(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', border: '1px solid #cbd5e0' }}
                />
                <button 
                  onClick={fetchShifts}
                  style={{ padding: '8px 20px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>Cargando historial de turnos...</div>
        ) : shifts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: '#f7fafc', borderRadius: '8px', color: '#718096' }}>
            No se encontraron turnos en el rango seleccionado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568' }}>Fecha</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568' }}>Guardia</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568' }}>Puesto</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568' }}>Inicio Turno</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#4a5568' }}>Fin Turno</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#4a5568' }}>Rondas</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#4a5568' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(shifts) && shifts.map((shift: any) => (
                  <tr key={shift.id_turno} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '15px', color: '#2d3748' }}>
                      {new Date(shift.fecha).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '15px', color: '#2d3748' }}>
                      <div style={{ fontWeight: 'bold' }}>{shift.nombre_guardia} {shift.apellido_guardia}</div>
                      <div style={{ fontSize: '0.8rem', color: '#718096' }}>{shift.rut_guardia}</div>
                    </td>
                    <td style={{ padding: '15px', color: '#2d3748' }}>
                      {shift.nombre_puesto || 'Sin puesto fijo'}
                    </td>
                    <td style={{ padding: '15px', color: '#2d3748' }}>
                      <div style={{ fontWeight: 'bold' }}>{shift.hora_inicio ? shift.hora_inicio.substring(0, 5) : '--:--'}</div>
                      {renderStartStatus(shift)}
                    </td>
                    <td style={{ padding: '15px', color: '#2d3748' }}>
                      <div style={{ fontWeight: 'bold' }}>{shift.hora_fin ? shift.hora_fin.substring(0, 5) : 'En curso...'}</div>
                      {renderEndStatus(shift)}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {renderCompliance(shift)}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {!shift.hora_fin ? (
                        <span style={{ backgroundColor: '#feebc8', color: '#c05621', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          ACTIVO
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#edf2f7', color: '#718096', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          CERRADO
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ShiftHistory;
