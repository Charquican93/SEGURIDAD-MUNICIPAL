import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../Layout.css';
import { API_URL } from '../config';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = React.useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    const session = localStorage.getItem('userSession');
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch (e) {}
    }
  }, []);

  // Guardar el estado del menú en localStorage
  React.useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Obtener conteo de mensajes no leídos
  const fetchUnreadMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/mensajes`);
      const count = response.data.filter((m: any) => m.emisor === 'GUARDIA' && !m.leido).length;
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    }
  };

  React.useEffect(() => {
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    navigate('/login');
  };

  const menuItems = [
    { 
      label: 'Panel Principal', 
      path: '/dashboard', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> 
    },
    { 
      label: 'Guardias en Vivo', 
      path: '/mapa', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> 
    },
    { 
      label: 'Historial de Rondas', 
      path: '/historial', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> 
    },
    { 
      label: 'Mensajería', 
      path: '/mensajes', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> 
    },
    { 
      label: 'Estadísticas', 
      path: '/estadisticas', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> 
    },
  ];

  const sidebarWidth = isCollapsed ? '80px' : '220px';

  return (
    <div className="app-container">
      {/* Estilos personalizados */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body, .app-container, button, input, select, textarea {
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Estilos globales para inputs y selectores */
        input, select, textarea {
          background-color: #ffffff;
          color: #2d3748;
          border: 1px solid #cbd5e0;
          border-radius: 8px;
          padding: 8px 12px;
        }
        input:focus, select:focus, textarea:focus {
          border-color: #3182ce;
          outline: none;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15);
        }

        /* Estilos globales para botones */
        button {
          border-radius: 10px;
          font-weight: 600;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        button:active {
          transform: scale(0.96);
        }

        /* Scrollbar horizontal estilizado y moderno */
        .custom-scrollbar {
          scrollbar-width: thin; /* Firefox */
          scrollbar-color: #cbd5e0 transparent; /* Firefox */
        }
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px; /* Altura del scroll horizontal */
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #a0aec0;
        }

        /* Efecto hover suave para items del menú */
        .menu-item {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 8px;
          margin: 4px 8px;
        }
        .menu-item:hover {
          background-color: rgba(255, 255, 255, 0.12);
          ${!isCollapsed ? 'transform: translateX(5px);' : ''}
        }

        /* Ajuste para hacer la barra lateral más estrecha en escritorio */
        @media (min-width: 769px) {
          .sidebar {
            width: ${sidebarWidth} !important;
            position: fixed !important;
            top: 0;
            bottom: 0;
            left: 0;
            transition: width 0.2s ease-in-out;
          }
          .main-content {
            margin-left: ${sidebarWidth} !important;
            width: auto !important;
            max-width: 100% !important;
            transition: margin-left 0.2s ease-in-out;
          }
          .content-body {
            max-width: none !important;
            width: 100% !important;
          }
        }
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: ${mobileMenuOpen ? '0' : '-280px'};
            top: 0;
            bottom: 0;
            z-index: 1000;
            transition: left 0.3s ease;
            width: 260px;
            box-shadow: 4px 0 10px rgba(0,0,0,0.1);
          }
          .main-content {
            width: 100%;
            margin-left: 0;
          }
          .mobile-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.4);
            z-index: 999;
            display: ${mobileMenuOpen ? 'block' : 'none'};
          }
          .menu-toggle {
            display: block !important;
          }
          .collapse-button {
            display: none !important;
          }
        }
        .menu-toggle {
          display: none;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          margin-right: 1rem;
          color: #4a5568;
          padding: 5px;
        }
        .collapse-button {
          display: flex !important;
        }
      `}</style>
      
      {/* Overlay oscuro para cerrar menú en móvil */}
      <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', paddingRight: isCollapsed ? 0 : '10px' }}>
          {!isCollapsed && 'Seguridad Municipal'}
          <div
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="collapse-button"
            style={{ 
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
             <span style={{ fontSize: '1.2rem', transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>❮</span>
          </div>
        </div>
        {user && (
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid rgba(255,255,255,0.1)', 
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '12px',
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
            <div style={{ overflow: 'hidden', display: isCollapsed ? 'none' : 'block' }}>
              <div>
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
          </div>
        )}
        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <div
              key={item.path}
              className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
              style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', position: 'relative' }}
              title={isCollapsed ? item.label : ''}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: isCollapsed ? 0 : '10px', minWidth: '24px', position: 'relative' }}>
                {item.icon}
                {isCollapsed && item.path === '/mensajes' && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#e53e3e',
                    borderRadius: '50%'
                  }} />
                )}
              </span>
              {!isCollapsed && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>{item.label}</span>
                  {item.path === '/mensajes' && unreadCount > 0 && (
                    <span style={{
                      backgroundColor: '#e53e3e',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      marginLeft: 'auto'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button" style={{ width: isCollapsed ? '44px' : 'auto', justifyContent: isCollapsed ? 'center' : 'flex-start', display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: isCollapsed ? 0 : '10px', minWidth: '24px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span style={{ display: isCollapsed ? 'none' : 'inline' }}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="main-content">
        <header className="header" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            ☰
          </button>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h1>
          <div className="user-info" style={{ marginLeft: 'auto' }}>
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