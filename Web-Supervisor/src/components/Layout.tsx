import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    navigate('/login');
  };

  const menuItems = [
    { label: 'Panel Principal', path: '/dashboard' },
    { label: 'Guardias en Vivo', path: '/mapa' }, // Futura implementación
    { label: 'Historial de Rondas', path: '/historial' }, // Futura implementación
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          Seguridad Municipal
        </div>
        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <div
              key={item.path}
              className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="main-content">
        <header className="header">
          <h1>{title}</h1>
          <div className="user-info">
            {/* Aquí podrías poner el nombre del supervisor logueado */}
            <span>Supervisor</span>
          </div>
        </header>
        <div className="content-body">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;