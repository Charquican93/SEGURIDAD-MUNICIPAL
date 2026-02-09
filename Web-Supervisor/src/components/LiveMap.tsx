import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

// Configuración para corregir el icono por defecto de Leaflet en React
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LiveMap: React.FC = () => {
  const [guards, setGuards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Coordenadas de Curicó, Chile
  const curicoCenter: [number, number] = [-34.9828, -71.2394];

  const fetchGuards = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/map-data`);
      setGuards(response.data);
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuards();
    // Actualizar posiciones cada 15 segundos
    const interval = setInterval(fetchGuards, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout title="Guardias en Vivo">
      <div style={{ 
        background: 'white', 
        padding: '15px', 
        borderRadius: '12px', 
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
        height: 'calc(100vh - 140px)', // Ajuste para llenar la pantalla
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#2d3748' }}>Mapa en Tiempo Real</h2>
            <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '0.9rem' }}>
              Mostrando {guards.length} guardia(s) activos en Curicó.
            </p>
          </div>
          <button 
            onClick={fetchGuards}
            style={{
              padding: '8px 15px',
              background: '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {loading ? 'Actualizando...' : 'Actualizar Ahora'}
          </button>
        </div>

        <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0 }}>
          <MapContainer 
            center={curicoCenter} 
            zoom={14} 
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {guards.map((guard) => (
              guard.latitud && guard.longitud && (
                <Marker key={guard.id_guardia} position={[guard.latitud, guard.longitud]}>
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '150px' }}>
                      <div style={{ fontWeight: 'bold', color: '#2d3748', fontSize: '1rem', marginBottom: '5px' }}>
                        {guard.nombre} {guard.apellido}
                      </div>
                      
                      <div style={{ marginBottom: '8px', padding: '8px', background: '#f0fff4', borderRadius: '6px', border: '1px solid #c6f6d5' }}>
                        <div style={{ fontSize: '0.7rem', color: '#2f855a', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>Rondas de Hoy</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#22543d' }}>
                          {guard.rondas_completadas || 0} / {guard.total_rondas || 0} Completadas
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '8px' }}>
                        Último reporte: {new Date(guard.fecha_hora).toLocaleTimeString()}
                      </div>
                      <a 
                        href={`https://www.google.com/maps?q=${guard.latitud},${guard.longitud}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          display: 'inline-block',
                          padding: '4px 8px',
                          background: '#e53e3e',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      >
                        Ver en Google Maps
                      </a>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>
    </Layout>
  );
};

export default LiveMap;
