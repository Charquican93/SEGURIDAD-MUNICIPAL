import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Configuración para corregir el icono por defecto de Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
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
  const [showRoundsModal, setShowRoundsModal] = useState(false);
  const [todaysRounds, setTodaysRounds] = useState<any[]>([]);
  const [guardFilter, setGuardFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [roundsPeriod, setRoundsPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [eventSearch, setEventSearch] = useState('');
  const [globalChecks, setGlobalChecks] = useState<any[]>([]);
  const [checkSearch, setCheckSearch] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState<{lat: number, lng: number, title?: string} | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // Nuevos estados para filtros independientes
  const [checkPeriod, setCheckPeriod] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [eventPeriod, setEventPeriod] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [alertPeriod, setAlertPeriod] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [alertSearch, setAlertSearch] = useState('');

  // Estados para paginación
  const [checksPage, setChecksPage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const ITEMS_PER_PAGE = 5; // Cantidad de registros por página

  // Referencias para el arrastre (drag-to-scroll) en Puestos
  const puestosContainerRef = useRef<HTMLDivElement>(null);
  const guardiasContainerRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Helper para calcular fechas y evitar problemas de zona horaria (Fix para filtros)
  const getDateParams = (period: string) => {
    const now = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const tomorrowStr = formatDate(tmrw);
    const todayStr = formatDate(now);

    if (period === 'hoy') {
      return { fecha_inicio: todayStr, fecha_fin: tomorrowStr };
    } 
    if (period === 'semana') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { fecha_inicio: formatDate(weekAgo), fecha_fin: tomorrowStr };
    } 
    if (period === 'mes') {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { fecha_inicio: formatDate(monthAgo), fecha_fin: tomorrowStr };
    }
    return {};
  };

  // Helper para filtrar datos en el cliente (Asegura que el filtro funcione visualmente)
  const filterDataClientSide = (data: any[], period: string, dateField: string) => {
    if (!Array.isArray(data)) return [];
    
    const now = new Date();
    // Normalizamos "hoy" al inicio del día local (00:00:00)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return data.filter(item => {
      if (!item[dateField]) return false;
      
      // Manejo robusto de fechas (ISO string o YYYY-MM-DD)
      let itemDate = new Date(item[dateField]);
      // Si es solo fecha YYYY-MM-DD (como en eventos), forzamos interpretación local
      if (dateField === 'date' && typeof item[dateField] === 'string' && item[dateField].length === 10) {
         const [y, m, d] = item[dateField].split('-').map(Number);
         itemDate = new Date(y, m - 1, d);
      }

      if (period === 'hoy') return itemDate >= todayStart && itemDate < todayEnd;
      if (period === 'semana') {
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return itemDate >= weekAgo;
      }
      if (period === 'mes') {
        const monthAgo = new Date(todayStart);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return itemDate >= monthAgo;
      }
      return true;
    });
  };

  const fetchData = async () => {
    // 1. Cargar estadísticas
    try {
      const response = await axios.get(`${API_URL}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
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

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/alerts`, {
        params: { search: alertSearch, periodo: alertPeriod, ...getDateParams(alertPeriod) }
      });
      // Filtramos en cliente para garantizar exactitud
      setAlerts(filterDataClientSide(response.data, alertPeriod, 'fecha_hora'));
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/events`, {
        params: { search: eventSearch, periodo: eventPeriod, ...getDateParams(eventPeriod) }
      });
      // Filtramos en cliente (campo 'date' suele ser YYYY-MM-DD)
      setEvents(filterDataClientSide(response.data, eventPeriod, 'date'));
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchChecks = async () => {
    try {
      const response = await axios.get(`${API_URL}/checks`, {
        params: { search: checkSearch, periodo: checkPeriod, ...getDateParams(checkPeriod) }
      });
      // Filtramos en cliente
      setGlobalChecks(filterDataClientSide(response.data, checkPeriod, 'fecha_hora'));
    } catch (error) {
      console.error('Error fetching checks:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Intervalo para datos estáticos (Stats, Puestos, Guardias)
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Intervalo para datos filtrados (Alertas, Eventos, Checks) - Se recrea al cambiar filtros para usar el estado actual
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts();
      fetchEvents();
      fetchChecks();
    }, 30000);
    return () => clearInterval(interval);
  }, [alertSearch, alertPeriod, eventSearch, eventPeriod, checkSearch, checkPeriod]);

  // Effects para filtros (Debounce y recarga al cambiar periodo)
  useEffect(() => {
    const debounceTimer = setTimeout(() => fetchEvents(), 300);
    setEventsPage(1); // Resetear página al filtrar
    return () => clearTimeout(debounceTimer);
  }, [eventSearch, eventPeriod]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => fetchChecks(), 300);
    setChecksPage(1); // Resetear página al filtrar
    return () => clearTimeout(debounceTimer);
  }, [checkSearch, checkPeriod]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => fetchAlerts(), 300);
    setAlertsPage(1); // Resetear página al filtrar
    return () => clearTimeout(debounceTimer);
  }, [alertSearch, alertPeriod]);

  // Estilo reutilizable para botones de filtro pequeños
  const getFilterButtonStyle = (isActive: boolean) => ({
    padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px',
    border: isActive ? 'none' : '1px solid #e2e8f0', backgroundColor: isActive ? '#3182ce' : 'white',
    color: isActive ? 'white' : '#718096', cursor: 'pointer', fontWeight: 'bold' as const
  });

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
    setExpandedRoundId(null);
    setRoundPoints([]);
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

  // Manejadores de eventos para el arrastre de Puestos
  const onMouseDownPuestos = (e: React.MouseEvent) => {
    if (!puestosContainerRef.current) return;
    isDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.pageX - puestosContainerRef.current.offsetLeft;
    scrollLeftRef.current = puestosContainerRef.current.scrollLeft;
    puestosContainerRef.current.style.cursor = 'grabbing';
  };

  const onMouseLeavePuestos = () => {
    isDownRef.current = false;
    if (puestosContainerRef.current) puestosContainerRef.current.style.cursor = 'grab';
  };

  const onMouseUpPuestos = () => {
    isDownRef.current = false;
    if (puestosContainerRef.current) puestosContainerRef.current.style.cursor = 'grab';
    // Pequeño retraso para permitir que el evento onClick verifique si fue arrastre
    setTimeout(() => { isDraggingRef.current = false; }, 0);
  };

  const onMouseMovePuestos = (e: React.MouseEvent) => {
    if (!isDownRef.current || !puestosContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - puestosContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 2; // Multiplicador de velocidad
    if (Math.abs(walk) > 5) isDraggingRef.current = true; // Si se mueve más de 5px, es arrastre
    puestosContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handlePuestoCardClick = (puesto: any) => {
    // Si se estaba arrastrando, ignorar el clic
    if (isDraggingRef.current) return;
    handlePuestoClick(puesto);
  };

  // Manejadores de eventos para el arrastre de Guardias
  const onMouseDownGuardias = (e: React.MouseEvent) => {
    if (!guardiasContainerRef.current) return;
    isDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.pageX - guardiasContainerRef.current.offsetLeft;
    scrollLeftRef.current = guardiasContainerRef.current.scrollLeft;
    guardiasContainerRef.current.style.cursor = 'grabbing';
  };

  const onMouseLeaveGuardias = () => {
    isDownRef.current = false;
    if (guardiasContainerRef.current) guardiasContainerRef.current.style.cursor = 'grab';
  };

  const onMouseUpGuardias = () => {
    isDownRef.current = false;
    if (guardiasContainerRef.current) guardiasContainerRef.current.style.cursor = 'grab';
    setTimeout(() => { isDraggingRef.current = false; }, 0);
  };

  const onMouseMoveGuardias = (e: React.MouseEvent) => {
    if (!isDownRef.current || !guardiasContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - guardiasContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 2;
    if (Math.abs(walk) > 5) isDraggingRef.current = true;
    guardiasContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleGuardCardClick = (guard: any) => {
    // Si se estaba arrastrando, ignorar el clic
    if (isDraggingRef.current) return;
    handleGuardClick(guard);
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

  const handleViewLocation = (lat: number, lng: number, title: string) => {
    setMapLocation({ lat, lng, title });
    setShowMapModal(true);
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  // Helper para paginación
  const paginate = (data: any[], page: number) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };

  // Renderizador de controles de paginación
  const renderPagination = (currentPage: number, totalItems: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px', alignItems: 'center' }}>
        <button 
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{ padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', background: currentPage === 1 ? '#f7fafc' : 'white', cursor: currentPage === 1 ? 'default' : 'pointer', color: currentPage === 1 ? '#cbd5e0' : '#4a5568', fontWeight: 'bold' }}
        >
          &lt;
        </button>
        <span style={{ fontSize: '0.8rem', color: '#718096' }}>{currentPage} de {totalPages}</span>
        <button 
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{ padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', background: currentPage === totalPages ? '#f7fafc' : 'white', cursor: currentPage === totalPages ? 'default' : 'pointer', color: currentPage === totalPages ? '#cbd5e0' : '#4a5568', fontWeight: 'bold' }}
        >
          &gt;
        </button>
      </div>
    );
  };

  // Calcular porcentaje actual basado en el periodo seleccionado
  const currentStats = stats.rounds[roundsPeriod] || { total: 0, completed: 0 };
  const currentProgress = currentStats.total > 0 
    ? Math.round((currentStats.completed / currentStats.total) * 100) 
    : 0;

  const getEventStyle = (type: string) => {
    switch (type) {
      case 'INCIDENCIA': return { backgroundColor: '#fed7d7', color: '#c53030' };
      case 'OBSERVACION': return { backgroundColor: '#feebc8', color: '#c05621' };
      default: return { backgroundColor: '#bee3f8', color: '#2b6cb0' };
    }
  };

  // Función auxiliar para renderizar el estado con alerta de atraso
  const renderRoundStatus = (ronda: any) => {
    const now = new Date();
    let isLate = false;
    let isEarly = false;
    let delayMin = 0;

    // Parsear fecha/hora programada
    if (ronda.hora) {
        const roundDate = ronda.fecha ? new Date(ronda.fecha) : new Date();
        const [h, m] = ronda.hora.split(':');
        roundDate.setHours(parseInt(h), parseInt(m), 0, 0);

        // 1. Lógica para PENDIENTES (Monitoreo en tiempo real)
        if (ronda.estado === 'PENDIENTE') {
            const diff = (now.getTime() - roundDate.getTime()) / 60000;
            if (diff > 10) { // Margen de 10 min
                isLate = true;
                delayMin = Math.floor(diff);
            }
        }
        
        // 2. Lógica para COMPLETADAS / EN PROGRESO (Histórico)
        // Verifica si existe 'hora_inicio' (hora real de marcaje) y compara
        if ((ronda.estado === 'COMPLETADA' || ronda.estado === 'EN_PROGRESO') && ronda.hora_inicio) {
             const [hI, mI] = ronda.hora_inicio.split(':');
             const startDate = new Date(roundDate); // Copia fecha base
             startDate.setHours(parseInt(hI), parseInt(mI), 0, 0);
             
             const diff = (startDate.getTime() - roundDate.getTime()) / 60000;
             if (diff > 10) {
                 isLate = true;
                 delayMin = Math.floor(diff);
             } else if (diff < -10) {
                 isEarly = true;
                 delayMin = Math.floor(Math.abs(diff));
             }
        }
    }

    if (isLate) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{
                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                    backgroundColor: '#fed7d7', color: '#c53030', border: '1px solid #feb2b2', whiteSpace: 'nowrap'
                }}>
                    {ronda.estado === 'PENDIENTE' ? 'ATRASADA' : 'INICIÓ TARDE'}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#e53e3e', fontWeight: 'bold' }}>
                    +{delayMin} min
                </span>
            </div>
        );
    }

    if (isEarly) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{
                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                    backgroundColor: '#bee3f8', color: '#2b6cb0', border: '1px solid #90cdf4', whiteSpace: 'nowrap'
                }}>
                    ANTICIPADA
                </span>
                <span style={{ fontSize: '0.65rem', color: '#3182ce', fontWeight: 'bold' }}>
                    -{delayMin} min
                </span>
            </div>
        );
    }

    return (
        <span style={{
            padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
            backgroundColor: ronda.estado === 'COMPLETADA' ? '#c6f6d5' : ronda.estado === 'EN_PROGRESO' ? '#feebc8' : '#edf2f7',
            color: ronda.estado === 'COMPLETADA' ? '#2f855a' : ronda.estado === 'EN_PROGRESO' ? '#c05621' : '#718096'
        }}>
            {ronda.estado}
        </span>
    );
  };

  return (
    <Layout title="Panel de Control">
      <style>{`
        @keyframes pulse-red {
          0% { background-color: transparent; }
          50% { background-color: rgba(229, 62, 62, 0.1); }
          100% { background-color: transparent; }
        }
        @keyframes pulse-green {
          0% {
            box-shadow: 0 0 0 0 rgba(56, 161, 105, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(56, 161, 105, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(56, 161, 105, 0);
          }
        }
        .blink-red {
          animation: pulse-red 2s infinite ease-in-out;
        }
      `}</style>
      {/* Puestos (Almohadillas Horizontales) */}

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '15px' }}>Puestos</h3>
        <div 
          className="custom-scrollbar" 
          ref={puestosContainerRef}
          onMouseDown={onMouseDownPuestos}
          onMouseLeave={onMouseLeavePuestos}
          onMouseUp={onMouseUpPuestos}
          onMouseMove={onMouseMovePuestos}
          style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', cursor: 'grab' }}
        >
          {puestos.length === 0 ? (
            <div style={{ padding: '15px', background: 'white', borderRadius: '8px', color: '#718096' }}>
              No hay puestos registrados.
            </div>
          ) : (
            puestos.map((puesto: any) => (
              <div key={puesto.id_puesto} onClick={() => handlePuestoCardClick(puesto)} style={{ 
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
        <div 
          className="custom-scrollbar" 
          ref={guardiasContainerRef}
          onMouseDown={onMouseDownGuardias}
          onMouseLeave={onMouseLeaveGuardias}
          onMouseUp={onMouseUpGuardias}
          onMouseMove={onMouseMoveGuardias}
          style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', cursor: 'grab' }}
        >
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
              <div key={guardia.id_guardia} onClick={() => handleGuardCardClick(guardia)} style={{ 
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
                <div style={{ fontSize: '0.85rem', marginTop: '8px', color: guardia.activo ? '#38a169' : '#a0aec0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {guardia.activo ? (
                    <span style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#38a169',
                      borderRadius: '50%',
                      animation: 'pulse-green 2s infinite'
                    }}></span>
                  ) : (
                    <span style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#cbd5e0',
                      borderRadius: '50%'
                    }}></span>
                  )}
                  <span>{guardia.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Tarjeta de Ejemplo 1 */}
        <div 
          onClick={() => navigate('/mapa')}
          style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
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
      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        {/* 1. Tabla de Checks de Presencia */}
        <div className="custom-scrollbar" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxHeight: '500px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#4a5568', fontSize: '1.1rem' }}>Checks de Presencia</h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setCheckPeriod('hoy')} style={getFilterButtonStyle(checkPeriod === 'hoy')}>Hoy</button>
              <button onClick={() => setCheckPeriod('semana')} style={getFilterButtonStyle(checkPeriod === 'semana')}>Sem</button>
              <button onClick={() => setCheckPeriod('mes')} style={getFilterButtonStyle(checkPeriod === 'mes')}>Mes</button>
            </div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0', zIndex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input
                type="text"
                placeholder="Buscar..."
                value={checkSearch}
                onChange={(e) => setCheckSearch(e.target.value)}
                style={{
                  padding: '6px 30px 6px 35px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e0',
                  fontSize: '0.85rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              {checkSearch && (
                <button
                  onClick={() => setCheckSearch('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          </div>
          {globalChecks.length === 0 ? (
            <p style={{ color: '#718096' }}>No hay checks recientes.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {paginate(globalChecks, checksPage).map((check: any) => (
                  <tr key={check.id_presencia} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '10px 0', color: '#2d3748' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '36px', height: '36px', borderRadius: '50%', 
                          background: '#3182ce', color: 'white', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0 
                        }}>
                          {check.nombre ? check.nombre.charAt(0) : ''}{check.apellido ? check.apellido.charAt(0) : ''}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', color: '#2d3748' }}>
                            {check.nombre && check.apellido ? `${check.nombre} ${check.apellido}` : 'Guardia (Sin nombre)'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#4a5568', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{check.puesto || 'Sin puesto'}</span>
                            {check.latitud && check.longitud && (
                              <button 
                                onClick={() => handleViewLocation(check.latitud, check.longitud, `Check: ${check.nombre} ${check.apellido}`)}
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  backgroundColor: '#3182ce',
                                  color: 'white',
                                  borderRadius: '6px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  lineHeight: '1'
                                }}
                              >
                                Ver <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '2px' }}>
                            {new Date(check.fecha_hora).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {renderPagination(checksPage, globalChecks.length, setChecksPage)}
        </div>

        {/* 2. Tabla de Últimas Alertas */}
        <div className="custom-scrollbar" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxHeight: '500px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#e53e3e', fontSize: '1.1rem' }}>Alertas de Pánico</h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setAlertPeriod('hoy')} style={getFilterButtonStyle(alertPeriod === 'hoy')}>Hoy</button>
              <button onClick={() => setAlertPeriod('semana')} style={getFilterButtonStyle(alertPeriod === 'semana')}>Sem</button>
              <button onClick={() => setAlertPeriod('mes')} style={getFilterButtonStyle(alertPeriod === 'mes')}>Mes</button>
            </div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0', zIndex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input
                type="text"
                placeholder="Buscar alerta..."
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                style={{
                  padding: '6px 30px 6px 35px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e0',
                  fontSize: '0.85rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              {alertSearch && (
                <button onClick={() => setAlertSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
              )}
            </div>
          </div>
          {alerts.length === 0 ? (
            <p style={{ color: '#718096' }}>No hay alertas recientes.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {paginate(alerts, alertsPage).map((alert: any, index) => (
                  <tr key={index} className={new Date(alert.fecha_hora).toDateString() === new Date().toDateString() ? "blink-red" : ""} style={{ borderBottom: '1px solid #edf2f7' }}>
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
                      <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{alert.descripcion}</span>
                        {alert.latitud && alert.longitud && (
                          <button 
                            onClick={() => handleViewLocation(alert.latitud, alert.longitud, `Alerta: ${alert.nombre} ${alert.apellido}`)}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              backgroundColor: '#e53e3e',
                              color: 'white',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              lineHeight: '1'
                            }}
                          >
                            Ver <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '4px' }}>
                        {new Date(alert.fecha_hora).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {renderPagination(alertsPage, alerts.length, setAlertsPage)}
        </div>

        {/* 3. Tabla de Eventos (Bitácora) */}
        <div className="custom-scrollbar" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxHeight: '500px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#4a5568', fontSize: '1.1rem' }}>Registro de Eventos</h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setEventPeriod('hoy')} style={getFilterButtonStyle(eventPeriod === 'hoy')}>Hoy</button>
              <button onClick={() => setEventPeriod('semana')} style={getFilterButtonStyle(eventPeriod === 'semana')}>Sem</button>
              <button onClick={() => setEventPeriod('mes')} style={getFilterButtonStyle(eventPeriod === 'mes')}>Mes</button>
            </div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0', zIndex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input
                type="text"
                placeholder="Buscar..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                style={{
                  padding: '6px 30px 6px 35px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e0',
                  fontSize: '0.85rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              {eventSearch && (
                <button
                  onClick={() => setEventSearch('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: 0
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          </div>
          {events.length === 0 ? (
            <p style={{ color: '#718096' }}>No hay eventos registrados.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {paginate(events, eventsPage).map((event: any) => (
                  <tr 
                    key={event.id} 
                    onClick={() => handleEventClick(event)}
                    style={{ borderBottom: '1px solid #edf2f7', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 0' }}>
                      <span style={{ 
                        ...getEventStyle(event.type),
                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' 
                      }}>{event.type}</span>
                    </td>
                    <td style={{ padding: '10px 0 10px 15px', color: '#2d3748' }}>
                      <div style={{ fontWeight: 'bold' }}>{event.author}</div>
                      <div style={{ fontSize: '0.85rem' }}>{event.description}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {event.date} {event.timestamp}
                      </div>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>
                      {event.photo && (
                        <div title="Ver evidencia fotográfica" style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: '#ebf8ff', 
                          color: '#3182ce',
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '50%',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {renderPagination(eventsPage, events.length, setEventsPage)}
        </div>
      </div>

      {/* Modal de Perfil y Rondas del Guardia */}
      {showGuardModal && selectedGuard && (
        <div onClick={closeGuardModal} style={{
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
          <div onClick={(e) => e.stopPropagation()} style={{
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
              <div style={{ display: 'flex', alignItems: 'center' }}>
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
                <button 
                  onClick={() => {
                    navigate('/mensajes', { state: { selectedGuard } });
                  }}
                  style={{ 
                    marginLeft: 'auto',
                    backgroundColor: '#3182ce',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Mensaje
                </button>
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
                      <th style={{ padding: '12px', textAlign: 'left', color: '#4a5568' }}>Guardia</th>
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
                          <td style={{ padding: '12px', color: '#2d3748' }}>
                            {ronda.nombre_guardia ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3182ce', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                  {ronda.nombre_guardia.charAt(0)}{ronda.apellido_guardia ? ronda.apellido_guardia.charAt(0) : ''}
                                </div>
                                <span>{ronda.nombre_guardia} {ronda.apellido_guardia}</span>
                              </div>
                            ) : <span style={{color: '#cbd5e0', fontStyle: 'italic'}}>Sin asignar</span>}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {renderRoundStatus(ronda)}
                          </td>
                          <td style={{ padding: '12px', color: '#4a5568' }}>
                            {ronda.puntos_marcados || 0} / {ronda.total_puntos || '?'} pts
                          </td>
                        </tr>
                        {expandedRoundId === ronda.id_ronda && (
                          <tr>
                            <td colSpan={5} style={{ padding: '15px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568' }}>Puntos de Control:</p>
                              {loadingPoints ? (
                                <p style={{ fontSize: '0.8rem', color: '#718096' }}>Cargando puntos...</p>
                              ) : roundPoints.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: '#718096' }}>No hay puntos registrados en esta ronda.</p>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
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
                                        padding: '8px', 
                                        borderRadius: '6px', 
                                        border: `1px solid ${point.marcado ? (isLate ? '#feb2b2' : isEarly ? '#90cdf4' : '#c6f6d5') : '#e2e8f0'}`,
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}>
                                        <div style={{ 
                                          width: '10px', 
                                          height: '10px', 
                                          borderRadius: '50%', 
                                          backgroundColor: point.marcado ? (isLate ? '#e53e3e' : isEarly ? '#3182ce' : '#38a169') : '#cbd5e0', 
                                          marginRight: '8px' 
                                        }} />
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '0.8rem', fontWeight: '500', color: point.marcado ? '#2d3748' : '#718096' }}>{point.nombre}</div>
                                          <div style={{ fontSize: '0.7rem', color: '#718096' }}>Ideal: {idealTimeStr}</div>
                                          {point.marcado && (
                                            <div style={{ fontSize: '0.7rem', color: isLate ? '#e53e3e' : isEarly ? '#3182ce' : '#38a169', fontWeight: (isLate || isEarly) ? 'bold' : 'normal' }}>
                                              Real: {new Date(point.hora_marcaje).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                              {isLate && ' (Atrasado)'}
                                              {isEarly && ' (Anticipado)'}
                                            </div>
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
        <div onClick={closePuestoModal} style={{
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
          <div onClick={(e) => e.stopPropagation()} style={{
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
                            {renderRoundStatus(ronda)}
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
                                            {new Date(point.hora_marcaje).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
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
          </div>
        </div>
      )}

      {/* Modal de Detalle de Rondas del Día */}
      {showRoundsModal && (
        <div onClick={() => setShowRoundsModal(false)} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
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
                          {renderRoundStatus(ronda)}
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

      {/* Modal de Mapa */}
      {showMapModal && mapLocation && (
        <div onClick={() => setShowMapModal(false)} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '800px',
            height: '500px', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#2d3748' }}>{mapLocation.title || 'Ubicación'}</h3>
              <button 
                onClick={() => setShowMapModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#718096' }}
              >
                &times;
              </button>
            </div>
            <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
               <MapContainer 
                  center={[mapLocation.lat, mapLocation.lng]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <Marker position={[mapLocation.lat, mapLocation.lng]}>
                    <Popup>{mapLocation.title}</Popup>
                  </Marker>
                </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Evento */}
      {showEventModal && selectedEvent && (
        <div onClick={() => setShowEventModal(false)} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '600px',
            maxHeight: '85vh', overflowY: 'auto', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <button 
              onClick={() => setShowEventModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#718096' }}
            >
              &times;
            </button>

            <h2 style={{ marginTop: 0, color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              Detalle del Evento
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ 
                backgroundColor: selectedEvent.type === 'INCIDENCIA' ? '#fed7d7' : selectedEvent.type === 'OBSERVACION' ? '#feebc8' : '#bee3f8', 
                color: selectedEvent.type === 'INCIDENCIA' ? '#c53030' : selectedEvent.type === 'OBSERVACION' ? '#c05621' : '#2b6cb0',
                padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' 
              }}>
                {selectedEvent.type}
              </span>
              <span style={{ float: 'right', color: '#718096', fontSize: '0.9rem' }}>
                {selectedEvent.date} {selectedEvent.timestamp}
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#4a5568' }}>Autor:</h4>
              <p style={{ margin: 0, color: '#2d3748', fontWeight: '500' }}>{selectedEvent.author}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#4a5568' }}>Descripción:</h4>
              <p style={{ margin: 0, color: '#2d3748', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{selectedEvent.description}</p>
            </div>

            {selectedEvent.photo && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#4a5568' }}>Fotografía Adjunta:</h4>
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f7fafc', display: 'flex', justifyContent: 'center' }}>
                  <img 
                    src={selectedEvent.photo.startsWith('data:image') ? selectedEvent.photo : `data:image/jpeg;base64,${selectedEvent.photo}`} 
                    alt="Evidencia" 
                    style={{ maxWidth: '100%', maxHeight: '400px', display: 'block' }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </Layout>
  );
};
export default Dashboard;