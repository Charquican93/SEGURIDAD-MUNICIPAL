import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Statistics: React.FC = () => {
  const [data, setData] = useState<any>({
    roundsDaily: [],
    events: [],
    topGuards: [],
    roundsByHour: [],
    roundsByRoute: []
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guards, setGuards] = useState<any[]>([]);
  const [puestos, setPuestos] = useState<any[]>([]);
  const [selectedGuard, setSelectedGuard] = useState('');
  const [selectedPuesto, setSelectedPuesto] = useState('');

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [guardsRes, puestosRes] = await Promise.all([
          axios.get(`${API_URL}/guardias`),
          axios.get(`${API_URL}/puestos`)
        ]);
        setGuards(guardsRes.data);
        setPuestos(puestosRes.data);
      } catch (error) {
        console.error('Error loading filters:', error);
      }
    };
    fetchFilters();
  }, []);

  const fetchData = async (start = startDate, end = endDate, guard = selectedGuard, puesto = selectedPuesto) => {
    setLoading(true);
    try {
      const params: any = {};
      if (start && end) {
        params.fecha_inicio = start;
        params.fecha_fin = end;
      } else {
        params.periodo = 'mes'; // Por defecto último mes
      }
      
      if (guard) params.id_guardia = guard;
      if (puesto) params.id_puesto = puesto;

      // Consultamos datos reales de rondas
      const response = await axios.get(`${API_URL}/rondas`, { params });
      const rondas = Array.isArray(response.data) ? response.data : [];

      // --- PROCESAMIENTO DE DATOS ---

      // 1. Rondas Diarias (Gráfico de Barras)
      const dailyMap = new Map();
      rondas.forEach((r: any) => {
        const dateObj = new Date(r.fecha);
        // Usamos fecha local para agrupar correctamente
        const dateKey = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
        
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { date: dateKey, total: 0, completed: 0, sortTime: dateObj.getTime() });
        }
        const entry = dailyMap.get(dateKey);
        entry.total += 1;
        if (r.estado === 'COMPLETADA') entry.completed += 1;
      });

      let roundsDaily = Array.from(dailyMap.values())
        .sort((a, b) => a.sortTime - b.sortTime)
        .map(({ date, total, completed }) => ({ date, total, completed }));
      
      // Si no hay filtro, mostramos últimos 7 días con datos
      if (!start && !end) roundsDaily = roundsDaily.slice(-7);

      // 2. Distribución de Estados (Gráfico de Torta)
      const statusCount: Record<string, number> = {};
      rondas.forEach((r: any) => {
        const status = r.estado || 'DESCONOCIDO';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });
      const events = Object.keys(statusCount).map(key => ({
        name: key.replace('_', ' '),
        value: statusCount[key]
      }));

      // 3. Top Guardias (Ranking)
      const guardsMap = new Map();
      rondas.forEach((r: any) => {
        if (r.estado === 'COMPLETADA' && r.nombre_guardia) {
          const name = `${r.nombre_guardia} ${r.apellido_guardia || ''}`.trim();
          guardsMap.set(name, (guardsMap.get(name) || 0) + 1);
        }
      });
      const topGuards = Array.from(guardsMap.entries())
        .map(([name, rondas]) => ({ name, rondas }))
        .sort((a, b) => b.rondas - a.rondas)
        .slice(0, 5);

      // 4. Carga Horaria (Rondas por Hora)
      const hourMap = new Array(24).fill(0);
      rondas.forEach((r: any) => {
        if (r.hora) {
          const hour = parseInt(r.hora.split(':')[0], 10);
          if (!isNaN(hour) && hour >= 0 && hour < 24) {
            hourMap[hour]++;
          }
        }
      });
      const roundsByHour = hourMap.map((count, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        count
      }));

      // 5. Rondas por Ruta
      const routeMap = new Map();
      rondas.forEach((r: any) => {
        const routeName = r.nombre_ruta || 'Sin Ruta';
        routeMap.set(routeName, (routeMap.get(routeName) || 0) + 1);
      });
      const roundsByRoute = Array.from(routeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Top 8 rutas

      setData({ roundsDaily, events, topGuards, roundsByHour, roundsByRoute });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilter = () => {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      alert('Por favor seleccione ambas fechas para filtrar por rango, o ninguna para ver el último mes.');
      return;
    }
    fetchData();
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    setSelectedGuard('');
    setSelectedPuesto('');
    fetchData('', '', '', '');
  };

  const handleExportPDF = async () => {
    const input = document.getElementById('report-content');
    if (!input) return;

    try {
      const canvas = await html2canvas(input, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Título dinámico con fechas
      const title = startDate && endDate 
        ? `Reporte de Estadísticas (${startDate} al ${endDate})`
        : 'Reporte de Estadísticas (General)';
        
      pdf.setFontSize(14);
      pdf.text(title, 10, 10);
      
      pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, pdfHeight);
      pdf.save(`reporte_estadisticas_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Hubo un error al generar el PDF.');
    }
  };

  // Colores para el gráfico de torta
  const COLORS = ['#48bb78', '#ecc94b', '#cbd5e0', '#e53e3e']; // Verde (Completada), Amarillo (Progreso), Gris (Pendiente)

  if (loading) {
    return (
      <Layout title="Estadísticas y Reportes">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#718096', fontSize: '1.2rem' }}>
          Cargando datos...
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Estadísticas y Reportes">
      <div id="report-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
        
        {/* Filtros de Fecha */}
        <div style={{ gridColumn: '1 / -1', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568', fontWeight: 'bold', fontSize: '0.9rem' }}>Fecha Inicio</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', color: '#4a5568', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568', fontWeight: 'bold', fontSize: '0.9rem' }}>Fecha Fin</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', color: '#4a5568', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568', fontWeight: 'bold', fontSize: '0.9rem' }}>Guardia</label>
            <select 
              value={selectedGuard}
              onChange={(e) => setSelectedGuard(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', color: '#4a5568', outline: 'none', minWidth: '150px' }}
            >
              <option value="">Todos</option>
              {guards.map((g: any) => <option key={g.id_guardia} value={g.id_guardia}>{g.nombre} {g.apellido}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568', fontWeight: 'bold', fontSize: '0.9rem' }}>Puesto</label>
            <select 
              value={selectedPuesto}
              onChange={(e) => setSelectedPuesto(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', color: '#4a5568', outline: 'none', minWidth: '150px' }}
            >
              <option value="">Todos</option>
              {puestos.map((p: any) => <option key={p.id_puesto} value={p.id_puesto}>{p.puesto}</option>)}
            </select>
          </div>
          <button 
            onClick={handleFilter}
            style={{ padding: '9px 20px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Filtrar
          </button>
          {(startDate || endDate || selectedGuard || selectedPuesto) && (
            <button 
              onClick={handleClear}
              style={{ padding: '9px 20px', background: '#e2e8f0', color: '#4a5568', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Limpiar
            </button>
          )}
          <button 
            onClick={handleExportPDF}
            style={{ padding: '9px 20px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}
          >
            Exportar PDF
          </button>
        </div>
        
        {/* Gráfico 1: Eficiencia de Rondas */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '20px' }}>Eficiencia de Rondas (Últimos 7 días)</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.roundsDaily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="total" name="Programadas" fill="#cbd5e0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completadas" fill="#48bb78" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribución de Eventos */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '20px' }}>Estado de Rondas</h3>
          <div style={{ height: '300px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data.events.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.events}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ percent }: any) => `${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {data.events.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: '#a0aec0' }}>No hay datos suficientes</p>
            )}
          </div>
        </div>

        {/* Gráfico 3: Top Guardias */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '20px' }}>Top Guardias - Rondas Completadas (Mes Actual)</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topGuards} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip cursor={{ fill: '#f7fafc' }} />
                <Bar dataKey="rondas" name="Rondas Completadas" fill="#3182ce" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Carga Horaria */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '20px' }}>Distribución Horaria de Rondas</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.roundsByHour}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#805ad5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#805ad5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" fontSize={12} interval={2} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="Rondas" stroke="#805ad5" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 5: Rondas por Ruta (Movido al final) */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '20px' }}>Rondas por Ruta (Top 8)</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.roundsByRoute} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} fontSize={11} />
                <Tooltip cursor={{ fill: '#f7fafc' }} />
                <Bar dataKey="value" name="Total Rondas" fill="#dd6b20" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Statistics;
