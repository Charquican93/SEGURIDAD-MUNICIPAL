import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import History from './components/History';
import LiveMap from './components/LiveMap';
import Messages from './components/Messages';
import Statistics from './components/Statistics';
import ShiftPlanning from './components/ShiftPlanning';
import ShiftHistory from './components/ShiftHistory';


function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta por defecto redirige al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Ruta de Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Ruta del Dashboard Real */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Ruta de Historial de Rondas */}
        <Route path="/historial" element={<History />} />

        {/* Ruta de Mapa en Vivo */}
        <Route path="/mapa" element={<LiveMap />} />

        {/* Ruta de Mensajería */}
        <Route path="/mensajes" element={<Messages />} />

        {/* Ruta de Estadísticas */}
        <Route path="/estadisticas" element={<Statistics />} />
        
        {/* Ruta de Planificacion */}
        <Route path="/planificacion" element={<ShiftPlanning />} />

        {/* Ruta de Historial de Turnos */}
        <Route path="/turnos" element={<ShiftHistory />} />

      </Routes>
    </Router>
  )
}

export default App
