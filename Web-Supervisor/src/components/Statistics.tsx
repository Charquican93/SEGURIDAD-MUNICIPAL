import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Statistics: React.FC = () => {
  const [data, setData] = useState<any>({
    roundsDaily: [],
    events: [],
    topGuards: []
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async (start = startDate, end = endDate) => {
    setLoading(true);
    try {
      const params: any = {};
      if (start && end) {
        params.startDate = start;
        params.endDate = end;
      }
      const response = await axios.get(`${API_URL}/dashboard/analytics`, { params });
      setData(response.data);
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
    if (startDate && endDate) {
      fetchData(startDate, endDate);
    } else {
      alert('Por favor seleccione ambas fechas');
    }
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    fetchData('', '');
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
  const COLORS = ['#e53e3e', '#dd6b20', '#3182ce']; // Rojo (Incidencia), Naranja (Obs), Azul (Notif)

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
      <div id="report-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '25px' }}>
        
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
          <button 
            onClick={handleFilter}
            style={{ padding: '9px 20px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Filtrar
          </button>
          {(startDate || endDate) && (
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
                <Legend />
                <Bar dataKey="total" name="Programadas" fill="#cbd5e0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completadas" fill="#48bb78" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribución de Eventos */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#4a5568', marginBottom: '20px' }}>Tipos de Reportes (Último Mes)</h3>
          <div style={{ height: '300px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data.events.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.events}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {data.events.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
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

      </div>
    </Layout>
  );
};

export default Statistics;
