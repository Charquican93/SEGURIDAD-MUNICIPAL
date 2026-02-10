import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Linking, Alert, Image, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Round, RoundStatus, UserProfile, TabType, LogEntry } from '../types';
import { useRoute, useNavigation } from '@react-navigation/native';
import { API_URL } from '../config';

const Dashboard = ({ onToggleTurn, onStartTurn }: { onToggleTurn?: () => void; onStartTurn?: () => void }) => {
  const route = useRoute();
  const navigation = useNavigation();
  // @ts-ignore
  const user: UserProfile | undefined = route.params?.user;
  // @ts-ignore
  const puesto: any | undefined = route.params?.puesto;
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold' }}>Error: No se recibió información del usuario.</Text>
        <Text style={{ marginTop: 8 }}>Por favor, vuelve a iniciar sesión.</Text>
      </View>
    );
  }
  const [activeTab, setActiveTab] = useState<TabType>('RONDAS');
  const [showProfileModal, setShowProfileModal] = useState(false);
  // Estado local para reflejar el estado activo del usuario en la UI
  const [isActive, setIsActive] = useState(user.isActive);
  const [currentTurnId, setCurrentTurnId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Funciones de carga de datos extraídas para reutilización
  const fetchActiveStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/guardias/estado?rut=${user.rut}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.activo !== 'undefined') {
          setIsActive(!!data.activo);
          if (data.id_turno) {
            setCurrentTurnId(data.id_turno);
          }
        }
      }
    } catch (e) {
      console.log('No se pudo sincronizar el estado activo:', e);
    }
  };

  // Función para contar mensajes no leídos
  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/mensajes?id_guardia=${user.id_guardia}`);
      if (res.ok) {
        const msgs = await res.json();
        const unread = msgs.filter((m: any) => !m.leido).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      console.log('Error fetching messages:', e);
    }
  };

  useEffect(() => {
    fetchActiveStatus();
    fetchUnreadMessages();
    // Polling de mensajes cada 15 segundos
    const msgInterval = setInterval(fetchUnreadMessages, 15000);
    return () => clearInterval(msgInterval);
  }, [user.rut]);

  // Función para generar color consistente basado en el nombre
  const getAvatarColor = (name: string) => {
    const colors = [
      'ef4444', 'f97316', 'ca8a04', '16a34a', '0d9488', 
      '2563eb', '4f46e5', '9333ea', 'db2777', 'e11d48'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const fullName = `${user.nombre} ${user.apellido}`;
  const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=${getAvatarColor(fullName)}&color=fff`;

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = async () => {
    if (!user?.id_guardia) return;
    try {
      const res = await fetch(`${API_URL}/bitacoras?id_guardia=${user.id_guardia}`);
      if (res.ok) {
        const data = await res.json();
        
        // Filtrar solo los registros del día actual
        const now = new Date();
        const mappedLogs = data
          .filter((l: any) => {
            if (!l.rawDate) return true; // Si no hay fecha raw, lo mostramos por seguridad
            const logDate = new Date(l.rawDate);
            return logDate.getDate() === now.getDate() &&
                   logDate.getMonth() === now.getMonth() &&
                   logDate.getFullYear() === now.getFullYear();
          })
          .map((l: any) => ({
            ...l,
            author: `${user.nombre} ${user.apellido}`
          }));
        setLogs(mappedLogs);
      }
    } catch (e) {
      console.log('Error cargando bitácoras:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'BITACORAS') {
      fetchLogs();
    }
  }, [user.id_guardia, activeTab]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newLogDesc, setNewLogDesc] = useState('');
  const [newLogType, setNewLogType] = useState<LogEntry['type']>('NOTIFICACION');
  const [showObservationsModal, setShowObservationsModal] = useState(false);
  const [showPanicSuccessModal, setShowPanicSuccessModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  
  // QR Scanning States
  const [showScanner, setShowScanner] = useState(false);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [checkDisabled, setCheckDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let interval: any;
    if (checkDisabled && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && checkDisabled) {
      setCheckDisabled(false);
    }
    return () => clearInterval(interval);
  }, [checkDisabled, countdown]);

  const [rounds, setRounds] = useState<Round[]>([]);

  const fetchRounds = async () => {
    try {
      // Filtramos por el guardia actual Y el puesto actual para evitar mezclar rondas
      let url = `${API_URL}/rondas?id_guardia=${user.id_guardia}`;
      if (puesto && puesto.id_puesto) {
        url += `&id_puesto=${puesto.id_puesto}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Mapear los datos de la BD al formato de la App
        const mappedRounds = data.map((r: any) => ({
          id: r.id_ronda.toString(),
          // Usamos el nombre de la ruta que trajimos con el JOIN
          location: r.nombre_ruta || `Ruta ${r.id_ruta}`,
          // Mapeamos el estado de la BD al estado de la App
          status: r.estado === 'COMPLETADA' ? RoundStatus.COMPLETED : RoundStatus.PENDING,
          // Formateamos la hora (quitamos los segundos si vienen HH:MM:SS)
          time: r.hora ? r.hora.substring(0, 5) : '00:00',
          date: r.fecha,
          // @ts-ignore
          totalPoints: r.total_puntos || 0,
          // @ts-ignore
          markedPoints: r.puntos_marcados || 0
        }));
        setRounds(mappedRounds);
      }
    } catch (e) {
      console.log('Error cargando rondas:', e);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchActiveStatus(), fetchRounds(), fetchLogs(), fetchUnreadMessages()]);
    setRefreshing(false);
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/mensajes?id_guardia=${user.id_guardia}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.reverse());
        // Marcar como leídos localmente (opcional, idealmente llamar a API)
      }
    } catch (e) {
      console.log('Error fetching messages:', e);
    }
  };

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;
    try {
      await fetch(`${API_URL}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_guardia: user.id_guardia,
          titulo: 'Mensaje',
          contenido: replyBody,
          emisor: 'GUARDIA'
        })
      });
      setReplyBody('');
      fetchMessages(); // Recargar lista
    } catch(e) { Alert.alert('Error', 'No se pudo enviar el mensaje'); }
  };

  // Función auxiliar para guardar en el backend
  const saveBitacora = async (tipo: string, descripcion: string) => {
    try {
      const response = await fetch(`${API_URL}/bitacoras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: user.rut, tipo, descripcion })
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (!response.ok) {
          console.log('Error del servidor al guardar bitácora:', data);
          Alert.alert('Error', 'No se pudo guardar: ' + (data.error || 'Error desconocido'));
        } else {
          console.log('Bitácora guardada exitosamente, ID:', data.id_bitacora);
        }
      } else {
        const text = await response.text();
        console.error('Respuesta no JSON del servidor:', text);
        Alert.alert('Error', 'El servidor respondió con un error inesperado (posiblemente la imagen es muy grande).');
      }
    } catch (e) {
      console.log('Error al guardar bitácora en servidor:', e);
      Alert.alert('Error', 'Fallo de conexión al guardar bitácora');
    }
  };

  const handleCheck = async () => {
    if (!isActive) {
      Alert.alert("Atención", "Debes iniciar turno para realizar el check.");
      return;
    }

    // Obtener ubicación
    let coords = { latitud: null as number | null, longitud: null as number | null };
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        coords = { latitud: location.coords.latitude, longitud: location.coords.longitude };
      }
    } catch (error) {
      console.log('No se pudo obtener la ubicación:', error);
    }

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const desc = `Check de presencia realizado a las ${currentTime}`;

    setLogs(prevLogs => [{
      id: `check-${Date.now()}`,
      timestamp: currentTime,
      date: new Date().toLocaleDateString(),
      type: 'NOTIFICACION',
      description: desc,
      author: `${user.nombre} ${user.apellido}`
    }, ...prevLogs]);

    // Guardar en la nueva tabla checks_presencia
    try {
      await fetch(`${API_URL}/checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id_guardia: user.id_guardia, 
          id_puesto: puesto ? puesto.id_puesto : null,
          latitud: coords.latitud,
          longitud: coords.longitud
        })
      });
    } catch (e) {
      console.log('Error al registrar check de presencia:', e);
    }

    setCountdown(5); // Tiempo de bloqueo
    setCheckDisabled(true);
  };

  const handleStartTurn = async () => {
    if (!isActive) {
      // Solo agregar una ronda de inicio de turno si no existe ya una para el día de hoy
      const today = new Date().toLocaleDateString();
      let alreadyStartedToday = false;
      setRounds(prevRounds => {
        alreadyStartedToday = prevRounds.some(r =>
          r.location === 'Inicio de Turno' &&
          (r.date === today || (r.time && r.time.length === 5 && r.id.startsWith('round-')))
        );
        if (alreadyStartedToday) {
          return prevRounds;
        }
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newRound: Round = {
          id: `round-${Date.now()}`,
          location: 'Inicio de Turno',
          status: RoundStatus.COMPLETED,
          time: currentTime,
          date: today
        };
        return [newRound, ...prevRounds];
      });
      if (alreadyStartedToday) {
        Alert.alert('Atención', 'Ya existe un inicio de turno registrado para hoy.');
        return;
      }
      // Actualizar estado activo en backend
      try {
        // Registrar inicio de turno en tabla turnos
        const res = await fetch(`${API_URL}/turnos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id_guardia: user.id_guardia, 
            id_puesto: puesto ? puesto.id_puesto : null 
          })
        });
        const data = await res.json();
        if (data.success && data.id_turno) {
          setCurrentTurnId(data.id_turno);
        }
      } catch (e) {
        Alert.alert('Error', 'No se pudo actualizar el estado del guardia en el servidor');
        return;
      }
      // Llamar a la función para cambiar el estado del usuario
      if (onStartTurn) {
        onStartTurn();
      } else if (onToggleTurn) {
        onToggleTurn();
      }
      setIsActive(true); // Cambia el estado local inmediatamente
    }
  };

  const handleEndTurn = async () => {
    if (isActive) {
      // Intentamos asegurar que tenemos el ID del turno
      let turnId = currentTurnId;
      
      if (!turnId) {
        // Si no hay ID en memoria, consultamos al backend una última vez
        try {
          const res = await fetch(`${API_URL}/guardias/estado?rut=${user.rut}`);
          const data = await res.json();
          if (data.id_turno) {
            turnId = data.id_turno;
          }
        } catch (e) {
          console.error("Error al recuperar ID de turno:", e);
        }
      }

      if (!turnId) {
        Alert.alert("Error", "No se encontró un turno abierto para finalizar. Es posible que ya esté cerrado.");
        // Forzamos estado inactivo localmente para corregir la UI si es necesario
        setIsActive(false);
        return;
      }

      // Agregar nueva ronda al final con la hora actual
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newRound: Round = {
        id: `round-${Date.now()}`,
        location: 'Fin de Turno',
        status: RoundStatus.COMPLETED,
        time: currentTime,
      };
      setRounds(prevRounds => [...prevRounds, newRound]);
      // Actualizar estado activo en backend
      try {
        // 1. Primero cerramos el turno en la tabla turnos (para asegurar que se registre la hora)
        const response = await fetch(`${API_URL}/turnos/${turnId}`, {
          method: 'PATCH'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error al cerrar turno en base de datos");
        }

        // 2. Luego desactivamos al guardia
        await fetch(`${API_URL}/guardias/activo`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rut: user.rut, activo: 0 })
        });
      } catch (e: any) {
        Alert.alert('Error', `No se pudo actualizar el estado: ${e.message}`);
        return; // Detenemos la ejecución para no cambiar el estado visual si falló la red
      }
      // Llamar a la función para cambiar el estado del usuario
      if (onToggleTurn) onToggleTurn();
      setIsActive(false); // Cambia el estado local inmediatamente
      setCurrentTurnId(null); // Limpiamos el ID del turno actual
    }
  };

  const handleStartRound = async (roundId: string) => {
    if (!permission) {
        await requestPermission();
    }
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("¡Alerta!", "Se necesita permiso de cámara para escanear el punto de control.");
        return;
      }
    }
    setActiveRoundId(roundId);
    setShowScanner(true);
  };

  const handleVigilanceControl = async () => {
    if (!isActive) {
      Alert.alert("¡Alerta!", "Debes iniciar tu turno antes de comenzar a escanear puntos de control");
      return;
    }
    
    const pendingRound = rounds.find(round => round.status === RoundStatus.PENDING);
    if (pendingRound) {
      // --- VALIDACIÓN DE HORA ---
      const now = new Date();
      const [hours, minutes] = pendingRound.time.split(':').map(Number);
      const roundTime = new Date();
      roundTime.setHours(hours, minutes, 0, 0);

      // Diferencia en minutos entre ahora y la hora de la ronda
      const diffMinutes = (now.getTime() - roundTime.getTime()) / 60000;

      // Ejemplo: No permitir marcar si faltan más de 30 minutos (diff < -30)
      if (diffMinutes < -30) {
        Alert.alert("Muy temprano", `Esta ronda está programada para las ${pendingRound.time}. Podrás iniciarla 30 minutos antes.`);
        return;
      }
      // --------------------------

      await handleStartRound(pendingRound.id);
    } else {
      Alert.alert("¡Alerta!", "No hay rondas pendientes para escanear.");
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setShowScanner(false);
    
    if (!isActive) {
      Alert.alert("¡Alerta!", "El turno debe estar activo para completar rondas.");
      return;
    }
    
    // Obtener ubicación para el marcaje
    let coords = { latitud: null as number | null, longitud: null as number | null };
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        coords = { latitud: location.coords.latitude, longitud: location.coords.longitude };
      }
    } catch (error) {
      console.log('No se pudo obtener la ubicación:', error);
    }

    // Logic to complete current round and activate next
    if (activeRoundId) {
      // Guardar en tabla marcajes_puntos
      try {
        const response = await fetch(`${API_URL}/marcajes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_ronda: activeRoundId,
            id_punto: data,
            latitud: coords.latitud,
            longitud: coords.longitud
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.log('Error servidor marcaje:', result);
          const title = response.status === 400 ? 'Advertencia' : 'Error de Marcaje';
          const message = response.status === 400 ? (result.error || 'Punto incorrecto') : ('No se pudo guardar en BD: ' + (result.error || 'Error desconocido'));
          Alert.alert(title, message);
        } else {
          console.log('Marcaje guardado correctamente, ID:', result.id_marcaje);
          
          if (result.roundCompleted) {
            Alert.alert("¡Ronda Completada!", "Has recorrido todos los puntos de control.");
            
            // Actualizar UI localmente solo si el servidor confirma que se completó
            setRounds(prevRounds => {
              const newRounds = [...prevRounds];
              const currentIndex = newRounds.findIndex(r => r.id === activeRoundId);
              
              if (currentIndex !== -1) {
                newRounds[currentIndex] = {
                  ...newRounds[currentIndex],
                  status: RoundStatus.COMPLETED,
                  completedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  // @ts-ignore
                  markedPoints: result.progress?.total || 0,
                  // @ts-ignore
                  totalPoints: result.progress?.total || 0
                };
                // Activar siguiente ronda si existe
                if (currentIndex + 1 < newRounds.length) {
                  newRounds[currentIndex + 1] = {
                    ...newRounds[currentIndex + 1],
                    status: RoundStatus.PENDING
                  };
                }
              }
              return newRounds;
            });

            // Guardar bitácora de finalización
            const completedRound = rounds.find(r => r.id === activeRoundId);
            saveBitacora('NOTIFICACION', `Ronda completada exitosamente: ${completedRound?.location}`);
            
          } else {
            // Ronda aún en progreso
            const progressText = result.progress ? `(${result.progress.current}/${result.progress.total})` : '';
            Alert.alert("Punto Registrado", `Marcaje correcto. Continúa con los siguientes puntos. ${progressText}`);
            
            // Actualizar progreso visualmente
            setRounds(prevRounds => {
              const newRounds = [...prevRounds];
              const currentIndex = newRounds.findIndex(r => r.id === activeRoundId);
              if (currentIndex !== -1 && result.progress) {
                // @ts-ignore
                newRounds[currentIndex].markedPoints = result.progress.current;
                // @ts-ignore
                newRounds[currentIndex].totalPoints = result.progress.total;
              }
              return newRounds;
            });

            // Opcional: Guardar bitácora de punto individual
            saveBitacora('NOTIFICACION', `Punto de control marcado (QR: ${data})`);
          }
        }
      } catch (e) {
        console.log('Error al guardar marcaje en BD:', e);
        Alert.alert('Error', 'Fallo de conexión al guardar el marcaje.');
      }

      setActiveRoundId(null);
    }
  };

  const handleAddLog = () => {
    if (!newLogDesc.trim()) return;

    const newEntry: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      type: newLogType,
      description: newLogDesc,
      author: `${user.nombre} ${user.apellido}`
    };

    setLogs([newEntry, ...logs]);
    saveBitacora(newLogType, newLogDesc); // Guardar en backend
    setNewLogDesc('');
    setShowAddModal(false);
  };

  const handleNoObservations = () => {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      type: 'OBSERVACION',
      description: 'Sin observaciones',
      author: `${user.nombre} ${user.apellido}`
    };
    setLogs([newEntry, ...logs]);
    saveBitacora('OBSERVACION', 'Sin observaciones'); // Guardar en backend
    setShowObservationsModal(false);
  };

  const handleOpenRegisterObservations = () => {
    setShowObservationsModal(false);
    setNewLogType('OBSERVACION');
    setShowAddModal(true);
  };

  const handlePanicButton = async () => {
    Alert.alert(
      "Confirmar Alerta de Pánico",
      "¿Estás seguro de que quieres enviar una alerta de pánico? Tu ubicación actual será enviada al supervisor.",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Enviar Alerta",
          onPress: async () => {
            try {
              // 1. Obtener permisos y ubicación
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación para enviar la alerta.');
                return;
              }

              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High, // Pedir la máxima precisión
              });
              const { latitude, longitude } = location.coords;

              // 2. Enviar datos al backend
              const response = await fetch(`${API_URL}/panic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_guardia: user.id_guardia, id_puesto: puesto?.id_puesto, latitud: latitude, longitud: longitude }),
              });

              if (response.ok) {
                setShowPanicSuccessModal(true);
              } else {
                // Manejo de error mejorado para evitar el crash por parseo de JSON
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error desconocido del servidor');
                } else {
                    const errorText = await response.text();
                    console.error("Respuesta no-JSON del servidor:", errorText); // Log del HTML para depuración
                    throw new Error('El servidor respondió con un error inesperado. Contacte a soporte.');
                }
              }
            } catch (error: any) { Alert.alert("Error", `No se pudo enviar la alerta: ${error.message}`); }
          },
          style: "destructive"
        }
      ]
    );
  };

  return (
    <View className="flex-1">
      <Header
        user={{
          ...user,
          isActive: isActive,
          name: `${user.nombre} ${user.apellido} \n ${puesto ? `${puesto.puesto} - ${puesto.instalaciones}` : 'Sin Puesto'}`,
          avatar: avatarUrl
        }}
        notificationCount={unreadCount}
        onProfilePress={() => { console.log('Perfil click'); setShowProfileModal(true); }}
        onNotificationsPress={() => { fetchMessages(); setShowMessagesModal(true); }}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={showProfileModal}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 p-6">
          <View className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl items-center">
            <Image
              source={{ uri: avatarUrl }}
              className="w-24 h-24 rounded-full mb-4 border-4 border-emerald-500"
            />
            <Text className="text-xl font-bold text-slate-900 mb-2 text-center">{user.nombre} {user.apellido}</Text>
            <Text className="text-sm text-slate-500 mb-4 text-center">{user.role || 'Guardia'}</Text>
            <View className="w-full gap-3 mb-4">
              <Text className="text-sm text-slate-700"><Text className="font-bold">RUT:</Text> {user.rut}</Text>
              <Text className="text-sm text-slate-700"><Text className="font-bold">Teléfono:</Text> {user.telefono}</Text>
              <Text className="text-sm text-slate-700"><Text className="font-bold">Correo:</Text> {user.correo}</Text>
              <Text className="text-sm text-slate-700"><Text className="font-bold">Puesto:</Text> {puesto ? puesto.puesto : 'No seleccionado'}</Text>
              <Text className="text-sm text-slate-700"><Text className="font-bold">Instalación:</Text> {puesto ? puesto.instalaciones : 'No seleccionada'}</Text>
            </View>
            <View className="flex-row gap-4 mb-4 w-full">
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                className="flex-1 bg-slate-100 py-3 rounded-xl items-center"
              >
                <Text className="text-slate-700 font-bold">Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const performLogout = async () => {
                    try {
                      await AsyncStorage.removeItem('userSession');
                    } catch (e) {
                      console.error('Error al cerrar sesión:', e);
                    }
                    setShowProfileModal(false);
                    // @ts-ignore
                    navigation.replace('Login');
                  };

                  if (isActive) {
                    Alert.alert(
                      "Turno Activo",
                      "Tienes un turno en curso. ¿Estás seguro de que quieres cerrar sesión sin finalizarlo?",
                      [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Cerrar Sesión", style: "destructive", onPress: performLogout }
                      ]
                    );
                  } else {
                    performLogout();
                  }
                }}
                className="flex-1 bg-red-500 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-bold">Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />
        }
      >
        {/* Stats Section */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 items-center justify-center">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Estado</Text>
            <Text className={`text-lg font-bold ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={handleCheck}
            disabled={checkDisabled || !isActive}
            className={`flex-1 p-4 rounded-2xl shadow-sm border border-slate-100 items-center justify-center ${
              checkDisabled || !isActive ? 'bg-slate-100' : 'bg-emerald-500'
            }`}
          >
            <MaterialIcons name="touch-app" size={28} color={checkDisabled || !isActive ? '#94a3b8' : 'white'} />
            <Text className={`text-xs font-bold mt-1 ${checkDisabled || !isActive ? 'text-slate-400' : 'text-white'}`}>
              {checkDisabled ? `Espere ${countdown}s` : 'Check'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botones de Turno alineados */}
        <View className="flex-row gap-4 mb-6">
          <TouchableOpacity
            onPress={handleStartTurn}
            disabled={isActive}
            className={`flex-1 rounded-3xl p-5 border h-36 justify-between ${
              !isActive
                ? 'bg-white border-slate-100'
                : 'bg-slate-100 border-transparent opacity-50'
            }`}
          >
            <View className="absolute -top-2 -right-2 w-20 h-20 rounded-full bg-blue-500/5 z-0" />
            <MaterialIcons name="play-circle-outline" size={40} color={!isActive ? '#3b82f6' : '#94a3b8'} />
            <Text className="font-bold text-lg leading-tight text-slate-900 z-10">Comenzar Turno</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEndTurn}
            disabled={!isActive}
            className={`flex-1 rounded-3xl p-5 border h-36 justify-between ${
              isActive
                ? 'bg-red-50 border-red-200'
                : 'bg-slate-100 border-transparent opacity-50'
            }`}
          >
            <View className="absolute -top-2 -right-2 w-20 h-20 rounded-full bg-red-500/10 z-0" />
            <MaterialIcons name="stop-circle" size={40} color={isActive ? '#ef4444' : '#fca5a5'} />
            <Text className="font-bold text-lg leading-tight text-red-600 z-10">Terminar Turno</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-4 w-full max-w-xl self-center justify-center">
            <TouchableOpacity 
              onPress={() => setShowObservationsModal(true)}
              className="flex-1 relative overflow-hidden rounded-3xl bg-amber-500 p-5 shadow-lg flex-row items-center justify-center h-24 min-w-[140px] max-w-[220px]"
            >
              <View className="flex-row items-center z-10 gap-2">
                <MaterialIcons name="remove-red-eye" size={28} color="white" />
                <View className="flex-col items-start">
                  <Text className="font-bold text-white text-xl">Eventos</Text>
                  <Text className="text-amber-100 text-xs font-medium mt-1">Registro de eventos</Text>
                </View>
              </View>
              <View className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handlePanicButton}
              className="flex-1 relative overflow-hidden rounded-3xl bg-red-700 p-5 shadow-lg flex-row items-center justify-center h-24 min-w-[140px] max-w-[220px]"
            >
              <View className="flex-row items-center z-10 gap-2">
                <MaterialIcons name="emergency-share" size={28} color="white" />
                <View className="flex-col items-start">
                  <Text className="font-bold text-white text-xl">Botón Pánico</Text>
                  <Text className="text-red-100 text-xs font-medium mt-1">Emergencias</Text>
                </View>
              </View>
              <View className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={handleVigilanceControl}
            className="relative overflow-hidden rounded-3xl bg-blue-700 p-5 shadow-lg flex-row items-center justify-between h-24 mt-4 w-full max-w-xl self-center"
          >
            <View className="flex-col items-start z-10">
              <Text className="font-bold text-white text-xl">Control de Vigilancia</Text>
              <Text className="text-blue-100 text-xs font-medium mt-1">Escanear punto de control</Text>
            </View>
            <View className="bg-white/20 p-3 rounded-2xl z-10 border border-white/10">
              <MaterialIcons name="qr-code-scanner" size={24} color="white" />
            </View>
            <View className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
          </TouchableOpacity>

        {/* Rondas/Bitacoras List */}
        <View className="bg-white rounded-t-[40px] shadow-2xl border-t border-slate-100 -mx-4 px-6 pt-6 pb-20 min-h-[400px]">
          <View className="flex-row items-center justify-between border-b border-slate-100 mb-6 relative">
            <View className="flex-1 flex-row">
              <TouchableOpacity 
                onPress={() => setActiveTab('RONDAS')}
                className={`flex-1 pb-4 border-b-2 items-center ${
                  activeTab === 'RONDAS' 
                    ? 'border-blue-500' 
                    : 'border-transparent'
                }`}
              >
                <Text className={`text-xs font-bold uppercase tracking-widest ${
                   activeTab === 'RONDAS' ? 'text-blue-500' : 'text-slate-400'
                }`}>Rondas</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setActiveTab('BITACORAS')}
                className={`flex-1 pb-4 border-b-2 items-center ${
                  activeTab === 'BITACORAS' 
                    ? 'border-blue-500' 
                    : 'border-transparent'
                }`}
              >
                <Text className={`text-xs font-bold uppercase tracking-widest ${
                   activeTab === 'BITACORAS' ? 'text-blue-500' : 'text-slate-400'
                }`}>Bitácoras</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-4">
            {activeTab === 'RONDAS' ? (
              rounds.map(round => (
                <RoundItem key={round.id} round={round} onStart={() => handleStartRound(round.id)} />
              ))
            ) : (
              <View className="gap-4">
                {logs.length > 0 ? (
                  logs.map(log => (
                    <LogItem key={log.id} log={log} />
                  ))
                ) : (
                  <View className="flex-1 items-center justify-center py-12 gap-3 opacity-60">
                     <MaterialIcons name="edit-document" size={48} color="#94a3b8" />
                     <Text className="text-sm font-medium text-slate-400">No hay bitácoras recientes</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modals fuera del ScrollView */}
      {/* Observations Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showObservationsModal}
        onRequestClose={() => setShowObservationsModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 p-6">
          <View className="w-full bg-white rounded-3xl p-6 shadow-2xl">
            <Text className="text-xl font-bold text-slate-900 mb-6 text-center">Registro de Observaciones</Text>
            <View className="gap-4">
              <TouchableOpacity 
                onPress={handleNoObservations}
                className="w-full bg-emerald-500 py-4 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg"
              >
                <MaterialIcons name="check-circle" size={24} color="white" />
                <Text className="text-white font-bold text-lg">Sin Observaciones</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleOpenRegisterObservations}
                className="w-full bg-amber-500 py-4 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg"
              >
                <MaterialIcons name="edit" size={24} color="white" />
                <Text className="text-white font-bold text-lg">Registrar Observación</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              onPress={() => setShowObservationsModal(false)}
              className="mt-6 items-center py-2"
            >
              <Text className="text-slate-400 font-bold">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Log Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddModal}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 justify-end bg-slate-900/40">
          <View className="w-full bg-white rounded-t-[32px] p-6 shadow-2xl h-[70%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-slate-900">Nuevo Evento</Text>
              <TouchableOpacity 
                onPress={() => setShowAddModal(false)}
                className="w-8 h-8 items-center justify-center rounded-full bg-slate-100"
              >
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View className="gap-4">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tipo de Evento</Text>
                <View className="flex-row gap-2">
                  {(['NOTIFICACION', 'INCIDENCIA', 'OBSERVACION'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewLogType(type)}
                      className={`flex-1 py-2 px-1 items-center justify-center rounded-xl border ${
                        newLogType === type 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${newLogType === type ? 'text-white' : 'text-slate-500'}`}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Descripción</Text>
                <TextInput 
                  value={newLogDesc}
                  onChangeText={setNewLogDesc}
                  placeholder="Describe lo ocurrido..."
                  multiline
                  numberOfLines={4}
                  style={{
                    width: '100%',
                    backgroundColor: '#f8fafc',
                    borderColor: '#cbd5e1',
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 16,
                    fontSize: 14,
                    minHeight: 120,
                    color: '#1e293b',
                    textAlignVertical: 'top'
                  }}
                />
              </View>

              <TouchableOpacity 
                onPress={handleAddLog}
                className="w-full bg-blue-500 py-4 rounded-2xl shadow-lg mt-4 items-center"
              >
                <Text className="text-white font-bold">Registrar en Bitácora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Messages Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showMessagesModal}
        onRequestClose={() => setShowMessagesModal(false)}
      >
        <View className="flex-1 bg-slate-50">
          <View className="p-4 bg-white border-b border-slate-200 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-slate-800">Mensajes</Text>
            <TouchableOpacity onPress={() => setShowMessagesModal(false)} className="p-2 bg-slate-100 rounded-full">
              <MaterialIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            className="flex-1 p-4" 
            contentContainerStyle={{ paddingBottom: 20 }}
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <Text className="text-center text-slate-400 mt-10">No hay mensajes.</Text>
            ) : (
              messages.map((msg) => (
                <View key={msg.id_mensaje} className={`mb-4 p-4 rounded-2xl max-w-[85%] ${msg.emisor === 'GUARDIA' ? 'bg-indigo-100 self-end rounded-tr-none' : 'bg-white self-start rounded-tl-none border border-slate-200'}`}>
                  <Text className={`text-xs font-bold mb-1 ${msg.emisor === 'GUARDIA' ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {msg.emisor === 'GUARDIA' ? 'Tú' : 'Supervisor'} • {new Date(msg.fecha_hora).toLocaleString()}
                  </Text>
                  <Text className="text-slate-600">{msg.contenido}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View className="p-4 bg-white border-t border-slate-200">
            <View className="flex-row gap-2 items-center">
              <TextInput
                value={replyBody}
                onChangeText={setReplyBody}
                placeholder="Escribe una respuesta..."
                className="flex-1 bg-slate-100 p-3 rounded-xl border border-slate-200"
                multiline
              />
              <TouchableOpacity 
                onPress={handleSendReply}
                className="bg-indigo-600 p-3 rounded-xl items-center justify-center"
              >
                <MaterialIcons name="send" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Panic Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPanicSuccessModal}
        onRequestClose={() => setShowPanicSuccessModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 p-6">
          <View className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl items-center border-2 border-red-50">
            <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="notifications-active" size={40} color="#ef4444" />
            </View>
            <Text className="text-2xl font-bold text-red-600 mb-2 text-center">¡Alerta Enviada!</Text>
            <Text className="text-slate-600 text-center mb-8 text-base px-2">
              Se ha notificado al supervisor con tu ubicación.
            </Text>
            <TouchableOpacity 
              onPress={() => setShowPanicSuccessModal(false)}
              className="w-full bg-red-600 py-4 rounded-2xl items-center shadow-lg shadow-red-500/30"
            >
              <Text className="text-white font-bold text-lg">Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Camera QR Scanner Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showScanner}
        onRequestClose={() => setShowScanner(false)}
      >
        <View className="flex-1 bg-black">
          <CameraView
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            style={{ flex: 1 }}
          >
            <View className="flex-1 bg-black/50 justify-center items-center">
                <View className="w-64 h-64 border-2 border-white/50 rounded-3xl bg-transparent relative">
                   <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl" />
                   <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl" />
                   <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl" />
                   <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl" />
                </View>
                <Text className="text-white mt-8 font-medium bg-black/50 px-4 py-2 rounded-full overflow-hidden">
                    Escanea el código QR del punto de control
                </Text>
            </View>
            <TouchableOpacity 
                onPress={() => setShowScanner(false)}
                className="absolute top-12 right-6 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
                <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </CameraView>
        </View>
      </Modal>
    </View>
  );
};

interface LogItemProps {
  log: LogEntry;
}

const LogItem: React.FC<LogItemProps> = ({ log }) => {
  const getTypeColor = () => {
    switch(log.type) {
      case 'INCIDENCIA': return 'bg-red-500';
      case 'OBSERVACION': return 'bg-amber-500';
      case 'NOTIFICACION':
      default: return 'bg-blue-500';
    }
  };

  return (
    <View className="bg-slate-50 border border-slate-100 rounded-3xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View className={`w-2 h-2 rounded-full ${getTypeColor()}`} />
          <Text className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">{log.type}</Text>
        </View>
        <Text className="text-[10px] font-medium text-slate-400">{log.date} {log.timestamp}</Text>
      </View>
      <Text className="text-sm text-slate-700 leading-relaxed mb-3">{log.description}</Text>
      <View className="pt-3 border-t border-slate-200 flex-row items-center gap-2">
        <MaterialIcons name="person" size={14} color="#94a3b8" />
        <Text className="text-[10px] font-medium text-slate-400">{log.author}</Text>
      </View>
    </View>
  );
};

interface RoundItemProps {
  round: Round;
  onStart?: () => void;
}

const RoundItem: React.FC<RoundItemProps> = ({ round, onStart }) => {
  const [expanded, setExpanded] = useState(false);
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isLocalRound = round.id.toString().startsWith('round-');

  const fetchPoints = async (showLoading = false) => {
    if (isLocalRound) return;

    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/rondas/${round.id}/puntos`);
      if (res.ok) {
        const data = await res.json();
        setPoints(data);
      }
    } catch (e) {
      console.log("Error cargando puntos:", e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchPoints(false);
    }
    // @ts-ignore
  }, [round.markedPoints]);

  const toggleExpand = async () => {
    if (isLocalRound) return;

    if (!expanded && points.length === 0) {
      await fetchPoints(true);
    }
    setExpanded(!expanded);
  };

  const getStatusConfig = () => {
    switch(round.status) {
      case RoundStatus.COMPLETED:
        return {
          icon: 'check-circle' as const,
          bg: 'bg-emerald-100',
          text: 'text-emerald-600',
          badge: null
        };
      case RoundStatus.PENDING:
        return {
          icon: 'schedule' as const,
          bg: 'bg-blue-100',
          text: 'text-blue-600',
          badge: null
        };
      case RoundStatus.SCHEDULED:
      default:
        return {
          icon: 'lock-clock' as const,
          bg: 'bg-slate-100',
          text: 'text-slate-400',
          badge: null
        };
    }
  };

  const config = getStatusConfig();

  // Lógica para mostrar texto de estado
  let statusText: string = "PENDIENTE";
  if (round.status === RoundStatus.COMPLETED) statusText = "COMPLETADA";
  else if (round.status === RoundStatus.SCHEDULED) statusText = "PROGRAMADA";

  // @ts-ignore
  if (round.status === RoundStatus.PENDING && round.markedPoints > 0) {
    statusText = "EN PROGRESO";
  }

  return (
    <TouchableOpacity 
      onPress={toggleExpand}
      activeOpacity={0.7}
      className={`p-4 rounded-3xl border border-slate-50 bg-slate-50/50 ${round.status === RoundStatus.SCHEDULED ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center">
        <View className={`w-12 h-12 rounded-full ${config.bg} items-center justify-center`}>
          <MaterialIcons name={config.icon} size={24} color={config.text.includes('slate') ? '#94a3b8' : config.text.includes('emerald') ? '#059669' : '#2563eb'} />
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-sm font-bold text-slate-800">{round.location}</Text>
          <Text className="text-[11px] font-medium text-slate-500 mt-0.5">
            {statusText} • {round.completedTime ? `${round.time} → ${round.completedTime}` : round.time}
            {/* @ts-ignore */}
            {(round.totalPoints > 0) && ` • Progreso: ${round.markedPoints || 0}/${round.totalPoints}`}
          </Text>
        </View>
        {!isLocalRound && (
          <MaterialIcons name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="#cbd5e1" />
        )}
      </View>

      {expanded && (
        <View className="mt-4 pt-4 border-t border-slate-200">
          {loading ? (
            <Text className="text-center text-slate-400 text-xs py-2">Cargando puntos...</Text>
          ) : (
            <View className="gap-2">
              <Text className="text-xs font-bold text-slate-500 mb-2 pl-1">Puntos de: {round.location}</Text>
              {points.map((point, index) => (
                <View key={index} className="flex-row items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className={`w-2 h-2 rounded-full ${point.marcado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <View>
                      <Text className="text-xs font-bold text-slate-700">{point.nombre}</Text>
                      {point.descripcion ? <Text className="text-[10px] text-slate-400" numberOfLines={1}>{point.descripcion}</Text> : null}
                    </View>
                  </View>
                  {point.marcado ? (
                    <View className="flex-row items-center gap-1">
                      <MaterialIcons name="check-circle" size={14} color="#10b981" />
                      <Text className="text-[10px] font-medium text-emerald-600">
                        {new Date(point.hora_marcaje).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-[10px] font-medium text-slate-400">Pendiente</Text>
                  )}
                </View>
              ))}
              {points.length === 0 && <Text className="text-center text-slate-400 text-xs">No hay puntos de control asignados.</Text>}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default Dashboard;
