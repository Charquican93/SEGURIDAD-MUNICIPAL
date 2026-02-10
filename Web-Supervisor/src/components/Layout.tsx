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
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const session = localStorage.getItem('userSession');
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch (e) {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    navigate('/login');
  };

  const menuItems = [
    { label: 'Panel Principal', path: '/dashboard' },
    { label: 'Guardias en Vivo', path: '/mapa' }, // Futura implementación
    { label: 'Historial de Rondas', path: '/historial' }, // Futura implementación
    { label: 'Mensajería', path: '/mensajes' },
    { label: 'Estadísticas', path: '/estadisticas' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          Seguridad Municipal
        </div>
        {user && (
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid rgba(255,255,255,0.1)', 
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#3182ce',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {user.nombre?.charAt(0)}{user.apellido?.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.nombre} {user.apellido}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>{user.rut}</div>
              <div style={{ 
                color: '#63b3ed', 
                fontSize: '0.7rem', 
                fontWeight: 'bold', 
                textTransform: 'uppercase',
                marginTop: '2px',
                letterSpacing: '0.5px'
              }}>
                Supervisor
              </div>
            </div>
          </div>
        )}
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
        <footer style={{ textAlign: 'center', padding: '20px', color: '#718096', fontSize: '0.8rem', marginTop: 'auto', borderTop: '1px solid #e2e8f0' }}>
          {/*© 2026 CCG - Desarrollado por Leonardo A. Gonzalez C.*/}
        </footer>
      </main>
    </div>
  );
};

export default Layout;