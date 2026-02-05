import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

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
      </Routes>
    </Router>
  )
}

export default App
