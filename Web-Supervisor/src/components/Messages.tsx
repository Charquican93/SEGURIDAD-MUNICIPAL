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
          <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#4a5568' }}>
            Guardias ({guards.length})
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
                        <div style={{ fontSize: '0.7rem', color: '#a0aec0', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                          {new Date(msg.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {new Date(msg.fecha_hora).toLocaleDateString()}
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
    </Layout>
  );
};

export default Messages;
