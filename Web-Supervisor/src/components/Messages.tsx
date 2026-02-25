import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Layout from './Layout';
import { API_URL } from '../config';

const Messages: React.FC = () => {
  const [guards, setGuards] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [selectedGuardId, setSelectedGuardId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastBody, setBroadcastBody] = useState('');

  // Cargar datos iniciales
  const fetchData = async () => {
    try {
      const [guardsRes, msgsRes] = await Promise.all([
        axios.get(`${API_URL}/guardias`),
        axios.get(`${API_URL}/mensajes`) // Trae todos los mensajes recientes
      ]);
      setGuards(guardsRes.data);
      setAllMessages(msgsRes.data);
    } catch (error) {
      console.error('Error cargando mensajería:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Actualizar cada 10s
    return () => clearInterval(interval);
  }, []);

  // Scroll al fondo del chat al cambiar de guardia o enviar mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedGuardId, allMessages]);

  // Marcar mensajes como leídos automáticamente al abrir el chat del guardia
  useEffect(() => {
    if (selectedGuardId && allMessages.length > 0) {
      const unreadMsgs = allMessages.filter(m => 
        m.id_guardia === selectedGuardId && 
        m.emisor === 'GUARDIA' && 
        !m.leido
      );

      if (unreadMsgs.length > 0) {
        // 1. Actualizar en el backend
        Promise.all(unreadMsgs.map(msg => 
          axios.patch(`${API_URL}/mensajes/${msg.id_mensaje}`, { leido: 1 })
        )).catch(e => console.error('Error marcando mensajes como leídos:', e));

        // 2. Actualizar estado local para que desaparezca la notificación visualmente
        setAllMessages(prev => prev.map(m => 
          (m.id_guardia === selectedGuardId && m.emisor === 'GUARDIA' && !m.leido)
            ? { ...m, leido: true }
            : m
        ));
      }
    }
  }, [selectedGuardId, allMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGuardId) return;

    setSending(true);
    try {
      await axios.post(`${API_URL}/mensajes`, {
        id_guardia: selectedGuardId,
        contenido: newMessage,
        emisor: 'SUPERVISOR'
      });
      setNewMessage('');
      fetchData(); // Recargar mensajes inmediatamente
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      alert('No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastBody.trim()) return;
    setSending(true);
    try {
      const res = await axios.post(`${API_URL}/mensajes/broadcast`, {
        titulo: 'ANUNCIO GENERAL',
        contenido: broadcastBody
      });
      alert(res.data.message || 'Difusión enviada correctamente');
      setBroadcastBody('');
      setShowBroadcastModal(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.error || 'Error al enviar difusión');
    } finally {
      setSending(false);
    }
  };

  // Filtrar y ordenar mensajes para el guardia seleccionado
  const activeChatMessages = selectedGuardId 
    ? allMessages
        .filter(m => m.id_guardia === selectedGuardId)
        .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
    : [];

  // Preparar lista de guardias con info de último mensaje
  const guardsList = guards.map(guard => {
    const guardMsgs = allMessages.filter(m => m.id_guardia === guard.id_guardia);
    const lastMsg = guardMsgs.length > 0 
      ? guardMsgs.sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime())[0] 
      : null;
    const unreadCount = guardMsgs.filter(m => m.emisor === 'GUARDIA' && !m.leido).length;
    
    return { ...guard, lastMsg, unreadCount };
  }).sort((a, b) => {
    // Ordenar: Primero los que tienen mensajes no leídos, luego por fecha del último mensaje
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    const timeA = a.lastMsg ? new Date(a.lastMsg.fecha_hora).getTime() : 0;
    const timeB = b.lastMsg ? new Date(b.lastMsg.fecha_hora).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <Layout title="Centro de Mensajería">
      <div style={{ 
        display: 'flex', 
        height: 'calc(100vh - 140px)', 
        background: 'white', 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        border: '1px solid #e2e8f0'
      }}>
        
        {/* Lista de Contactos (Izquierda) */}
        <div style={{ width: '300px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
          <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#4a5568', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Guardias ({guards.length})</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button 
                onClick={() => setShowBroadcastModal(true)}
                style={{ 
                  background: 'white', 
                  border: '1px solid #e53e3e', 
                  cursor: 'pointer', 
                  color: '#e53e3e', 
                  padding: '5px 12px', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e53e3e'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#e53e3e'; }}
                title="Enviar mensaje a todos los activos"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                Difusión
              </button>
              <button 
                onClick={fetchData}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3182ce', padding: '4px', display: 'flex', alignItems: 'center' }}
                title="Recargar mensajes"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {guardsList.map(guard => (
              <div 
                key={guard.id_guardia}
                onClick={() => setSelectedGuardId(guard.id_guardia)}
                style={{
                  padding: '15px',
                  borderBottom: '1px solid #edf2f7',
                  cursor: 'pointer',
                  backgroundColor: selectedGuardId === guard.id_guardia ? '#ebf8ff' : 'transparent',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', 
                    background: '#3182ce', color: 'white', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' 
                  }}>
                    {guard.nombre.charAt(0)}{guard.apellido.charAt(0)}
                  </div>
                  {guard.activo ? (
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: '#48bb78', borderRadius: '50%', border: '2px solid white' }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600', color: '#2d3748', fontSize: '0.9rem' }}>{guard.nombre} {guard.apellido}</span>
                    {guard.unreadCount > 0 && (
                      <span style={{ background: '#e53e3e', color: 'white', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        {guard.unreadCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {guard.lastMsg ? (
                      <span>
                        {guard.lastMsg.emisor === 'SUPERVISOR' ? 'Tú: ' : ''}
                        {guard.lastMsg.contenido}
                      </span>
                    ) : <span style={{ fontStyle: 'italic', color: '#cbd5e0' }}>Sin mensajes</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Área de Chat (Derecha) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          {selectedGuardId ? (
            <>
              {/* Encabezado del Chat */}
              <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', background: 'white' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2d3748' }}>
                  {guards.find(g => g.id_guardia === selectedGuardId)?.nombre} {guards.find(g => g.id_guardia === selectedGuardId)?.apellido}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#718096', background: '#edf2f7', padding: '2px 8px', borderRadius: '12px' }}>
                  {guards.find(g => g.id_guardia === selectedGuardId)?.rut}
                </span>
              </div>

              {/* Mensajes */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', background: '#f7fafc' }}>
                {activeChatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#a0aec0', marginTop: '40px' }}>
                    No hay historial de conversación.<br/>¡Envía el primer mensaje!
                  </div>
                ) : (
                  activeChatMessages.map(msg => {
                    const isMe = msg.emisor === 'SUPERVISOR';
                    return (
                      <div key={msg.id_mensaje} style={{ 
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                      }}>
                        <div style={{ 
                          background: isMe ? '#3182ce' : 'white',
                          color: isMe ? 'white' : '#2d3748',
                          padding: '10px 15px',
                          borderRadius: '12px',
                          borderTopRightRadius: isMe ? '2px' : '12px',
                          borderTopLeftRadius: isMe ? '12px' : '2px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          border: isMe ? 'none' : '1px solid #e2e8f0'
                        }}>
                          {msg.contenido}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#a0aec0', marginTop: '4px', textAlign: isMe ? 'right' : 'left', display: 'flex', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '4px' }}>
                          {new Date(msg.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} • {new Date(msg.fecha_hora).toLocaleDateString()}
                          {isMe && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={msg.leido ? "#3182ce" : "#cbd5e0"} xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 7L16.59 5.59L10.25 11.93L11.66 13.34L18 7ZM22.24 5.59L11.66 16.17L7.48 12L6.07 13.41L11.66 19L23.66 7L22.24 5.59ZM0.41 13.41L6 19L7.41 17.59L1.83 12L0.41 13.41Z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de Envío */}
              <form onSubmit={handleSendMessage} style={{ padding: '15px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  style={{ flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #cbd5e0', outline: 'none' }}
                />
                <button 
                  type="submit" 
                  disabled={sending || !newMessage.trim()}
                  style={{ 
                    background: '#3182ce', color: 'white', border: 'none', 
                    padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer',
                    opacity: sending ? 0.7 : 1
                  }}
                >
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', flexDirection: 'column' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💬</div>
              <div>Selecciona un guardia para comenzar a chatear</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Difusión */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div style={{
            background: 'white', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '500px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#e53e3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              Mensaje de Difusión
            </h3>
            <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '15px' }}>
              Este mensaje será enviado a <strong>todos los guardias activos</strong> en este momento. Úselo para alertas o anuncios generales.
            </p>
            <textarea
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Escriba su anuncio aquí..."
              style={{ width: '100%', minHeight: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0', marginBottom: '5px', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#718096', marginBottom: '20px' }}>
              {broadcastBody.length} caracteres
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowBroadcastModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0', background: 'white', color: '#4a5568', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleBroadcast} disabled={sending || !broadcastBody.trim()} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#e53e3e', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>{sending ? 'Enviando...' : 'Enviar a Todos'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Messages;
