import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ExportReports: React.FC = () => {
  const [guards, setGuards] = useState<any[]>([]);
  const [selectedGuard, setSelectedGuard] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [options, setOptions] = useState({
    turnos: true,
    rondas: true,
    checks: true,
    alertas: true,
    eventos: true
  });

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchGuards = async () => {
      try {
        const res = await axios.get(`${API_URL}/guardias`);
        setGuards(res.data);
      } catch (error) {
        console.error('Error cargando guardias:', error);
      }
    };
    fetchGuards();
  }, []);

  const handleOptionChange = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGeneratePreview = async () => {
    if (!selectedGuard || !startDate || !endDate) {
      alert('Por favor seleccione un guardia y un rango de fechas.');
      return;
    }

    setLoading(true);
    setReportData(null);

    try {
      const params = {
        id_guardia: selectedGuard,
        fecha_inicio: startDate,
        fecha_fin: endDate
      };

      const requests: Promise<any>[] = [];
      const keys: string[] = [];

      if (options.turnos) {
        requests.push(axios.get(`${API_URL}/turnos`, { params }));
        keys.push('turnos');
      }
      if (options.rondas) {
        requests.push(axios.get(`${API_URL}/rondas`, { params }));
        keys.push('rondas');
      }
      if (options.checks) {
        // Asumiendo que el endpoint de checks soporta filtros de fecha, si no, filtramos en cliente
        requests.push(axios.get(`${API_URL}/checks`, { params }));
        keys.push('checks');
      }
      if (options.alertas) {
        requests.push(axios.get(`${API_URL}/dashboard/alerts`, { params: { ...params, periodo: 'custom' } })); // Ajustar según soporte backend
        keys.push('alertas');
      }
      if (options.eventos) {
        requests.push(axios.get(`${API_URL}/dashboard/events`, { params: { ...params, periodo: 'custom' } })); // Ajustar según soporte backend
        keys.push('eventos');
      }

      const responses = await Promise.all(requests);
      const data: any = {};
      
      responses.forEach((res, index) => {
        data[keys[index]] = res.data;
      });

      // Obtener info del guardia seleccionado
      const guardInfo = guards.find(g => String(g.id_guardia) === String(selectedGuard));
      data.guardia = guardInfo;

      setReportData(data);
      
      // Desplazar la pantalla hacia la vista previa automáticamente
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al obtener los datos para el reporte.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);

    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Si el contenido es muy largo, jsPDF lo corta. 
      // Para reportes simples de una página o ajustados:
      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
         // Lógica básica para multipágina (corte simple)
         let heightLeft = pdfHeight;
         let position = 0;
         const pageHeight = pdf.internal.pageSize.getHeight();

         pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
         heightLeft -= pageHeight;

         while (heightLeft >= 0) {
           position = heightLeft - pdfHeight;
           pdf.addPage();
           pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
           heightLeft -= pageHeight;
         }
      } else {
         pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const guardName = reportData?.guardia ? `${reportData.guardia.nombre} ${reportData.guardia.apellido}` : 'Reporte';
      pdf.save(`Reporte_${guardName.replace(/\s+/g, '_')}_${startDate || 'General'}.pdf`);

    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el archivo PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Layout title="Exportación de Reportes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Panel de Configuración */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>Configuración del Reporte</h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4a5568', fontSize: '0.9rem' }}>Guardia</label>
              <select 
                value={selectedGuard}
                onChange={(e) => setSelectedGuard(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0' }}
              >
                <option value="">-- Seleccionar Guardia --</option>
                {guards.map((g: any) => (
                  <option key={g.id_guardia} value={g.id_guardia}>{g.nombre} {g.apellido} - {g.rut}</option>
                ))}
              </select>
            </div>
            
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4a5568', fontSize: '0.9rem' }}>Fecha Inicio</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4a5568', fontSize: '0.9rem' }}>Fecha Fin</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#4a5568', fontSize: '0.9rem' }}>Incluir en el reporte:</label>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {Object.keys(options).map((key) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'capitalize', color: '#2d3748' }}>
                  <input 
                    type="checkbox" 
                    checked={options[key as keyof typeof options]} 
                    onChange={() => handleOptionChange(key as keyof typeof options)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '25px', display: 'flex', gap: '15px' }}>
            <button 
              onClick={handleGeneratePreview}
              disabled={loading}
              style={{ 
                padding: '12px 25px', 
                background: '#3182ce', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Generando...' : 'Generar Vista Previa'}
            </button>
            
            {reportData && (
              <button 
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                style={{ 
                  padding: '12px 25px', 
                  background: '#e53e3e', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: generatingPdf ? 0.7 : 1
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                {generatingPdf ? 'Exportando...' : 'Descargar PDF'}
              </button>
            )}

            {reportData && (
              <button 
                onClick={() => setReportData(null)}
                style={{ 
                  padding: '12px 25px', 
                  background: '#718096', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                }}
              >
                Cerrar Vista Previa
              </button>
            )}
          </div>
        </div>

        {/* Vista Previa del Reporte (Lo que se imprimirá) */}
        {reportData && (
          <div style={{ overflowX: 'auto', background: '#525659', padding: '20px', borderRadius: '12px' }}>
            <div 
              ref={reportRef}
              style={{ 
                background: 'white', 
                width: '210mm', // Ancho A4
                minHeight: '297mm', // Alto A4 mínimo
                padding: '20mm', 
                margin: '0 auto',
                boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                color: '#000',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              {/* Encabezado del Reporte */}
              <div style={{ borderBottom: '2px solid #2b6cb0', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h1 style={{ margin: 0, color: '#2b6cb0', fontSize: '24px' }}>Reporte de Actividad</h1>
                  <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '12px' }}>Seguridad Municipal - Sistema de Gestión</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#718096' }}>Fecha de Emisión: {new Date().toLocaleDateString()}</div>
                  <div style={{ fontSize: '12px', color: '#718096' }}>Periodo: {startDate} al {endDate}</div>
                </div>
              </div>

              {/* Información del Guardia */}
              <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#2d3748' }}>Información del Personal</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                  <div><strong>Nombre:</strong> {reportData.guardia?.nombre} {reportData.guardia?.apellido}</div>
                  <div><strong>RUT:</strong> {reportData.guardia?.rut}</div>
                  <div><strong>Teléfono:</strong> {reportData.guardia?.telefono || 'N/A'}</div>
                  <div><strong>Email:</strong> {reportData.guardia?.correo || 'N/A'}</div>
                </div>
              </div>

              {/* Sección: Turnos */}
              {options.turnos && reportData.turnos && (
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '5px', color: '#2d3748', fontSize: '16px' }}>Historial de Turnos</h3>
                  {reportData.turnos.length === 0 ? (
                    <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#718096' }}>No hay turnos registrados en este periodo.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
                      <thead>
                        <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Fecha</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Inicio</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Fin</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Puesto</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Rondas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.turnos.map((t: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #edf2f7' }}>
                            <td style={{ padding: '8px' }}>{new Date(t.fecha).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{t.hora_inicio?.substring(0,5) || '--'}</td>
                            <td style={{ padding: '8px' }}>{t.hora_fin?.substring(0,5) || 'Activo'}</td>
                            <td style={{ padding: '8px' }}>{t.nombre_puesto || '-'}</td>
                            <td style={{ padding: '8px' }}>{t.rondas_completadas}/{t.rondas_totales}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Sección: Rondas */}
              {options.rondas && reportData.rondas && (
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '5px', color: '#2d3748', fontSize: '16px' }}>Detalle de Rondas</h3>
                  {reportData.rondas.length === 0 ? (
                    <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#718096' }}>No hay rondas registradas.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
                      <thead>
                        <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Fecha</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Hora Prog.</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Ruta</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Estado</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Puntos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.rondas.map((r: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #edf2f7' }}>
                            <td style={{ padding: '8px' }}>{new Date(r.fecha).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{r.hora?.substring(0,5)}</td>
                            <td style={{ padding: '8px' }}>{r.nombre_ruta}</td>
                            <td style={{ padding: '8px' }}>{r.estado}</td>
                            <td style={{ padding: '8px' }}>{r.puntos_marcados}/{r.total_puntos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Sección: Checks */}
              {options.checks && reportData.checks && (
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '5px', color: '#2d3748', fontSize: '16px' }}>Checks de Presencia</h3>
                  {reportData.checks.length === 0 ? (
                    <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#718096' }}>No hay checks registrados.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' }}>
                      {reportData.checks.map((c: any, i: number) => (
                        <div key={i} style={{ border: '1px solid #e2e8f0', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 'bold' }}>{new Date(c.fecha_hora).toLocaleString()}</div>
                          <div style={{ color: '#718096' }}>{c.puesto || 'Sin puesto'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sección: Alertas y Eventos */}
              {(options.alertas || options.eventos) && (
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '5px', color: '#2d3748', fontSize: '16px' }}>Alertas y Eventos</h3>
                  
                  {options.alertas && reportData.alertas && reportData.alertas.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <h4 style={{ fontSize: '14px', color: '#e53e3e', margin: '10px 0' }}>Alertas de Pánico</h4>
                      <ul style={{ fontSize: '12px', paddingLeft: '20px' }}>
                        {reportData.alertas.map((a: any, i: number) => (
                          <li key={i} style={{ marginBottom: '5px' }}>
                            <strong>{new Date(a.fecha_hora).toLocaleString()}:</strong> {a.tipo} - {a.descripcion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {options.eventos && reportData.eventos && reportData.eventos.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '14px', color: '#3182ce', margin: '10px 0' }}>Bitácora de Eventos</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <tbody>
                          {reportData.eventos.map((e: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #edf2f7' }}>
                              <td style={{ padding: '8px', width: '120px' }}>{e.date} {e.timestamp}</td>
                              <td style={{ padding: '8px', fontWeight: 'bold', width: '100px' }}>{e.type}</td>
                              <td style={{ padding: '8px' }}>{e.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {(!reportData.alertas?.length && !reportData.eventos?.length) && (
                     <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#718096' }}>No hay alertas ni eventos registrados.</p>
                  )}
                </div>
              )}

              {/* Pie de Página */}
              <div style={{ marginTop: '40px', borderTop: '1px solid #cbd5e0', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#a0aec0' }}>
                Documento generado automáticamente por el Sistema de Seguridad Municipal.
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ExportReports;
