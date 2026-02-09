import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import History from './components/History';
import LiveMap from './components/LiveMap';


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
      </Routes>
    </Router>
  )
}

export default App
