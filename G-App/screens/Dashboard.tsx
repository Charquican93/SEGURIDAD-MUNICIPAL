import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Image, RefreshControl, Animated, Pressable, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Round, RoundStatus, UserProfile, TabType, LogEntry } from '../types';
import { useRoute, useNavigation } from '@react-navigation/native';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext'; // Asegúrate de crear este archivo primero

// Componente de Botón "Mantener para Activar" (Hold-to-Act)
const HoldButton = ({ 
  onActivate, 
  duration = 1000, 
  children, 
  className = "", 
  fillColor = "rgba(0,0,0,0.2)",
  disabled = false,
  style = {}
}: any) => {
  const progress = useRef(new Animated.Value(0)).current;
  
  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onActivate();
        progress.setValue(0);
      }
    });
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={`relative overflow-hidden ${className}`}
      style={style}
      disabled={disabled}
    >
      <Animated.View 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: fillColor, width: width, zIndex: 0 }
        ]} 
      />
      <View className="z-10 w-full h-full">
        {children}
      </View>
    </Pressable>
  );
};

const Dashboard = ({ onToggleTurn, onStartTurn }: { onToggleTurn?: () => void; onStartTurn?: () => void }) => {
  const route = useRoute();
  const navigation = useNavigation();
  // @ts-ignore
  const user: UserProfile | undefined = route.params?.user;
  // @ts-ignore
  const [puesto, setPuesto] = useState<any | undefined>(route.params?.puesto);
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold' }}>Error: No se recibió información del usuario.</Text>
        <Text style={{ marginTop: 8 }}>Por favor, vuelve a iniciar sesión.</Text>
      </View>
    );
  }
  const { theme, toggleTheme, isDark } = useTheme(); // Hook del tema
  const [activeTab, setActiveTab] = useState<TabType>('RONDAS');
  const [showProfileModal, setShowProfileModal] = useState(false);
  // Estado local para reflejar el estado activo del usuario en la UI
  const [isActive, setIsActive] = useState(user.isActive);
  const [currentTurnId, setCurrentTurnId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState<{url: string, method: string, body: any, timestamp: number, type: string}[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'hoy' | 'semana'>('hoy');
  const [debugTapCount, setDebugTapCount] = useState(0);

  // Función para manejar cierre de sesión forzado por token inválido/expirado
  const handleSessionExpiry = async () => {
    try {
      await AsyncStorage.removeItem('userSession');
      Alert.alert('Sesión Caducada', 'Tus credenciales ya no son válidas. Por favor inicia sesión nuevamente.');
      // @ts-ignore
      navigation.replace('Login');
    } catch (e) {
      console.error('Error al limpiar sesión:', e);
    }
  };

  // Nueva función de Reset de Emergencia (Solución para turno fantasma)
  const handleEmergencyReset = async () => {
    Alert.alert(
      "Restablecer Estado",
      "Esto forzará el cierre de cualquier turno activo y limpiará los datos locales. Úsalo si la App quedó pegada con un turno fantasma.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Restablecer", 
          style: "destructive", 
          onPress: async () => {
            try {
              // INTENTO ADICIONAL: Si la App tiene un ID de turno en memoria, intentamos cerrarlo formalmente en BD
              if (currentTurnId) {
                 try {
                   await fetch(`${API_URL}/turnos/${currentTurnId}`, { method: 'PATCH' });
                 } catch(e) { console.log("No se pudo cerrar el turno por ID específico, continuando con reset general."); }
              }

              // 1. Forzar inactividad en backend
              await fetch(`${API_URL}/guardias/activo`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut: user.rut, activo: 0 })
              });
              
              // 2. Limpiar estado local
              setIsActive(false);
              setCurrentTurnId(null);
              setRounds([]);
              
              // 3. Intentar recuperar el puesto actualizado
              fetchProfileUpdate();
              
              Alert.alert("Listo", "El estado ha sido restablecido. Desliza hacia abajo para actualizar.");
            } catch (e) {
              Alert.alert("Error de Conexión", "Se forzará el reset localmente.");
              setIsActive(false);
              setCurrentTurnId(null);
              setRounds([]);
            }
          }
        }
      ]
    );
  };

  // Funciones de carga de datos extraídas para reutilización
  const fetchActiveStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/guardias/estado?rut=${user.rut}`);
      if (res.status === 401 || res.status === 403) {
        handleSessionExpiry();
        return;
      }
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
      // Fallo silencioso en sincronización de estado
    }
  };

  // NUEVA FUNCIÓN: Actualizar información del puesto/perfil desde el servidor
  const fetchProfileUpdate = async () => {
    if (!user) return;
    try {
      // 1. Consultar estado actual (Turno activo tiene prioridad)
      const statusRes = await fetch(`${API_URL}/guardias/estado?rut=${user.rut}`);
      if (statusRes.status === 401 || statusRes.status === 403) {
        handleSessionExpiry();
        return;
      }
      
      let isActiveOnServer = false;

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        isActiveOnServer = !!statusData.activo;
        
        // Si hay turno activo y trae info de puesto, actualizamos
        if (statusData.activo && statusData.id_turno && statusData.puesto) {
           setPuesto(statusData.puesto);
           return; 
        }
        
        // PROTECCIÓN: Si está activo pero el endpoint no trajo el objeto puesto (posible limitación del backend),
        // y ya tenemos un puesto localmente (del Login), NO lo borramos. Mantenemos el actual.
        if (statusData.activo && puesto) {
            return;
        }
      }

      // 2. Si no hay turno activo, consultamos el perfil del guardia por si se le asignó puesto fijo recientemente
      const guardRes = await fetch(`${API_URL}/guardias/${user.id_guardia}`);
      if (guardRes.ok) {
        const guardData = await guardRes.json();
        if (guardData.id_puesto) {
           // Si tiene ID de puesto, traemos el objeto completo si no lo tenemos o es diferente
           if (!puesto || puesto.id_puesto !== guardData.id_puesto) {
              const puestoRes = await fetch(`${API_URL}/puestos/${guardData.id_puesto}`);
              if (puestoRes.ok) {
                const puestoData = await puestoRes.json();
                setPuesto(puestoData);
              }
           }
        } else {
           // 3. (CORRECCIÓN) Si no tiene puesto fijo, buscamos en las rondas de HOY (Asignación por Planificación)
           // Usamos rango de fechas explícito (Hoy + Mañana) para evitar problemas de zona horaria con el servidor
           const now = new Date();
           const formatDate = (d: Date) => {
               const year = d.getFullYear();
               const month = String(d.getMonth() + 1).padStart(2, '0');
               const day = String(d.getDate()).padStart(2, '0');
               return `${year}-${month}-${day}`;
           };
           const start = formatDate(now);
           const tmrw = new Date(now);
           tmrw.setDate(tmrw.getDate() + 1);
           const end = formatDate(tmrw);

           const roundsRes = await fetch(`${API_URL}/rondas?id_guardia=${user.id_guardia}&fecha_inicio=${start}&fecha_fin=${end}`);
           let foundInRounds = false;
           let shouldClearPuesto = false; // Flag para decidir si limpiamos (solo si la respuesta es exitosa y vacía)

           if (roundsRes.ok) {
              const roundsData = await roundsRes.json();
              // Buscamos el primer id_puesto válido en las rondas (o id_ruta si se usa como puesto)
              const roundWithPuesto = roundsData.find((r: any) => r.id_puesto || r.id_ruta);
              if (roundWithPuesto) {
                 const targetId = roundWithPuesto.id_puesto || roundWithPuesto.id_ruta;
                 // Solo hacemos fetch si no tenemos puesto o es diferente al encontrado
                 if (!puesto || String(puesto.id_puesto) !== String(targetId)) {
                     // Intentamos obtener el puesto específico. Si falla, usamos fallback de lista completa.
                     try {
                        let puestoData = null;
                        const puestoRes = await fetch(`${API_URL}/puestos/${targetId}`);
                        if (puestoRes.ok) {
                            puestoData = await puestoRes.json();
                        } else {
                            // Fallback: Obtener todos los puestos y buscar localmente
                            const allPuestosRes = await fetch(`${API_URL}/puestos`);
                            if (allPuestosRes.ok) {
                                const allPuestos = await allPuestosRes.json();
                                puestoData = allPuestos.find((p: any) => String(p.id_puesto) === String(targetId));
                            }
                        }

                        if (puestoData) {
                            setPuesto(puestoData);
                            foundInRounds = true;
                        }
                     } catch (e) {
                        console.log("Error recuperando detalles del puesto:", e);
                     }
                 } else {
                     foundInRounds = true; // Ya tenemos el puesto correcto cargado
                 }
              }
              
              // Si la respuesta fue OK pero no encontramos puesto en las rondas, marcamos para limpiar
              if (!foundInRounds && roundsData.length === 0) {
                  shouldClearPuesto = true;
              }
           }
           
           // Solo limpiamos si el servidor confirmó que no hay rondas Y no estamos activos
           if (shouldClearPuesto && puesto && !isActiveOnServer && !isActive) setPuesto(undefined);
        }
      }
    } catch (e) {
      console.log("Error actualizando perfil:", e);
    }
  };

  // Función para contar mensajes no leídos
  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/mensajes?id_guardia=${user.id_guardia}`);
      if (res.status === 401 || res.status === 403) {
        handleSessionExpiry();
        return;
      }
      if (res.ok) {
        const msgs = await res.json();
        // Filtrado robusto: considera no leído si es 0, false, null o "0"
        const unread = msgs.filter((m: any) => 
          (m.leido === 0 || m.leido === false || m.leido === null || m.leido === "0") && 
          m.emisor !== 'GUARDIA'
        ).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      // Error al obtener mensajes
    }
  };

  // Cargar cola offline al iniciar
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const q = await AsyncStorage.getItem('offlineQueue');
        if (q) setOfflineQueue(JSON.parse(q));
      } catch (e) {}
    };
    loadQueue();
  }, []);

  // Guardar cola en almacenamiento
  const persistQueue = async (newQueue: any[]) => {
    setOfflineQueue(newQueue);
    await AsyncStorage.setItem('offlineQueue', JSON.stringify(newQueue));
  };

  // Agregar acción a la cola
  const queueAction = async (url: string, method: string, body: any, type: string) => {
    const newQueue = [...offlineQueue, { url, method, body, timestamp: Date.now(), type }];
    await persistQueue(newQueue);
    // No mostramos alerta intrusiva, solo un log o un toast discreto sería ideal
    console.log(`Acción guardada offline: ${type}`);
  };

  // Procesar cola (Sincronización)
  const processQueue = async () => {
    if (offlineQueue.length === 0) return;
    
    let newQueue = [...offlineQueue];
    let processedCount = 0;

    // Intentamos procesar en orden
    for (const item of offlineQueue) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body)
        });
        
        if (res.ok) {
          newQueue = newQueue.filter(i => i.timestamp !== item.timestamp);
          processedCount++;
        } else {
          // Si el servidor responde pero con error (ej: 500), decidimos si reintentar o no.
          // Por ahora, asumimos que si hay respuesta, no es problema de conexión, pero mantenemos en cola si es crítico.
          // Para simplificar, si falla fetch (catch) es offline. Si res.ok es false, es error lógico.
        }
      } catch (e) {
        // Error de red, detenemos el procesamiento para reintentar luego
        break;
      }
    }

    if (processedCount > 0) {
      await persistQueue(newQueue);
      if (processedCount > 0) {
        Alert.alert("Conexión Recuperada", `${processedCount} registros pendientes se han sincronizado.`);
        onRefresh(); // Actualizar datos frescos del servidor
      }
    }
  };

  useEffect(() => {
    fetchActiveStatus();
    fetchUnreadMessages();
    fetchProfileUpdate(); // Intentar actualizar puesto al cargar
    // Polling de mensajes cada 15 segundos
    const msgInterval = setInterval(() => {
      fetchUnreadMessages();
      processQueue(); // Intentar sincronizar cola offline
    }, 15000);
    return () => clearInterval(msgInterval);
  }, [user.rut, offlineQueue]); // Agregamos offlineQueue para que el closure tenga el estado actualizado

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
      // Error cargando bitácoras
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
  const [newLogPhoto, setNewLogPhoto] = useState<string | null>(null);
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
      // Filtramos solo por el guardia actual para ver todas sus rondas asignadas
      let roundsUrl = `${API_URL}/rondas?id_guardia=${user.id_guardia}`;
      let turnsUrl = `${API_URL}/turnos?id_guardia=${user.id_guardia}`;
      
      if (periodFilter === 'hoy') {
        const now = new Date();
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const start = formatDate(now);
        const tmrw = new Date(now);
        tmrw.setDate(tmrw.getDate() + 1);
        const end = formatDate(tmrw);
        
        const queryParams = `&fecha_inicio=${start}&fecha_fin=${end}`;
        roundsUrl += queryParams;
        turnsUrl += queryParams;
      } else {
        roundsUrl += `&periodo=${periodFilter}`;
        turnsUrl += `&periodo=${periodFilter}`;
      }

      const [resRounds, resTurns] = await Promise.all([
        fetch(roundsUrl),
        fetch(turnsUrl)
      ]);

      let combinedItems: Round[] = [];

      if (resRounds.ok) {
        const dataRounds = await resRounds.json();
        // Mapear los datos de la BD al formato de la App
        const mappedRounds = dataRounds.map((r: any) => ({
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
        combinedItems = [...mappedRounds];
      }

      if (resTurns.ok) {
        const dataTurns = await resTurns.json();
        if (Array.isArray(dataTurns)) {
          dataTurns.forEach((t: any) => {
            // Evento: Inicio de Turno
            if (t.hora_inicio) {
              combinedItems.push({
                id: `turn-start-${t.id_turno}`,
                location: 'Inicio de Turno',
                status: RoundStatus.COMPLETED,
                time: t.hora_inicio.substring(0, 5),
                date: t.fecha
              });
            }
            // Evento: Fin de Turno
            if (t.hora_fin) {
              combinedItems.push({
                id: `turn-end-${t.id_turno}`,
                location: 'Fin de Turno',
                status: RoundStatus.COMPLETED,
                time: t.hora_fin.substring(0, 5),
                date: t.fecha
              });
            }
          });
        }
      }

      // Ordenar cronológicamente todo junto
      combinedItems.sort((a, b) => {
        // 1. Por fecha (si estamos viendo semana/mes)
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        
        // 2. Por hora
        return a.time.localeCompare(b.time);
      });

      setRounds(combinedItems);
    } catch (e) {
      // Error cargando rondas
    }
  };

  useEffect(() => {
    fetchRounds();
  }, [periodFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchActiveStatus(), fetchRounds(), fetchLogs(), fetchUnreadMessages(), fetchProfileUpdate()]);
    setRefreshing(false);
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/mensajes?id_guardia=${user.id_guardia}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.reverse());
        
        // Identificar mensajes no leídos del supervisor
        const unread = data.filter((m: any) => 
          (m.leido === 0 || m.leido === false || m.leido === null || m.leido === "0") && 
          m.emisor !== 'GUARDIA'
        );
        
        if (unread.length > 0) {
          setUnreadCount(0); // Limpiar notificación visualmente de inmediato
          
          // Actualizar estado en el backend para cada mensaje no leído
          await Promise.all(unread.map((msg: any) => 
            fetch(`${API_URL}/mensajes/${msg.id_mensaje}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ leido: 1 })
            }).catch(e => console.log('Error marcando leido:', e))
          ));
        }
      }
    } catch (e) {
      // Error fetching messages
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
  const saveBitacora = async (tipo: string, descripcion: string, foto: string | null = null) => {
    try {
      const response = await fetch(`${API_URL}/bitacoras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: user.rut, tipo, descripcion, foto })
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (!response.ok) {
          Alert.alert('Error', 'No se pudo guardar: ' + (data.error || 'Error desconocido'));
        } else {
        }
      } else {
        const text = await response.text();
        console.error('Respuesta no JSON del servidor:', text);
        Alert.alert('Error', 'El servidor respondió con un error inesperado (posiblemente la imagen es muy grande).');
      }
    } catch (e) {
      // En lugar de error, guardamos en cola
      queueAction(`${API_URL}/bitacoras`, 'POST', { rut: user.rut, tipo, descripcion, foto }, 'Bitácora');
      Alert.alert('Modo Offline', 'Sin conexión. El evento se guardó localmente y se enviará cuando recuperes internet.');
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
      // No se pudo obtener la ubicación
    }

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const desc = `Check de presencia realizado a las ${currentTime}`;

    const tempLogId = `check-${Date.now()}`;

    setLogs(prevLogs => [{
      id: tempLogId,
      timestamp: currentTime,
      date: new Date().toLocaleDateString(),
      type: 'NOTIFICACION',
      description: desc,
      author: `${user.nombre} ${user.apellido}`
    }, ...prevLogs]);

    // Guardar en la nueva tabla checks_presencia
    try {
      const body = { 
        id_guardia: user.id_guardia, 
        id_puesto: puesto ? puesto.id_puesto : null,
        latitud: coords.latitud,
        longitud: coords.longitud
      };

      const response = await fetch(`${API_URL}/checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error('Server error');
      }
    } catch (e) {
      // Si falla la conexión, NO revertimos. Guardamos en cola.
      queueAction(`${API_URL}/checks`, 'POST', { 
        id_guardia: user.id_guardia, 
        id_puesto: puesto ? puesto.id_puesto : null,
        latitud: coords.latitud,
        longitud: coords.longitud
      }, 'Check Presencia');
      
      Alert.alert('Modo Offline', 'Check registrado localmente. Se sincronizará automáticamente.');
    }

    setCountdown(5); // Tiempo de bloqueo
    setCheckDisabled(true);
  };

  const handleStartTurn = async () => {
    if (!isActive) {
      // --- VALIDACIÓN DE HORARIO (NO BLOQUEANTE) ---
      let timeStatus = "A tiempo";
      const now = new Date();
      
      // Buscamos la primera ronda programada para hoy
      const pendingRoundsToday = rounds.filter(r => {
        if (r.status !== RoundStatus.PENDING) return false;
        if (r.location === 'Inicio de Turno' || r.location === 'Fin de Turno') return false;
        // Validación simple de fecha si existe
        if (r.date) {
           const datePart = r.date.toString().split('T')[0];
           const [y, m, d] = datePart.split('-').map(Number);
           if (y && m && d) return y === now.getFullYear() && m === (now.getMonth() + 1) && d === now.getDate();
        }
        return true;
      }).sort((a, b) => a.time.localeCompare(b.time));

      if (pendingRoundsToday.length > 0) {
        const firstRound = pendingRoundsToday[0];
        const [hours, minutes] = firstRound.time.split(':').map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(hours, minutes, 0, 0);

        const diffMinutes = (now.getTime() - scheduleTime.getTime()) / 60000;

        if (diffMinutes > 10) timeStatus = "ATRASADO";
        else if (diffMinutes < -10) timeStatus = "ANTICIPADO";
      }

      const today = new Date().toLocaleDateString();


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
        } else {
          // Si falla la respuesta pero no es error de red, seguimos activos localmente
          console.warn('Respuesta servidor turno:', data);
        }
        
        if (timeStatus === "ATRASADO") {
          Alert.alert("Turno Iniciado", "Atención: Has iniciado turno fuera del margen de 10 minutos (Atrasado). Se ha registrado la incidencia.");
        }
      } catch (e) {
        // Revertir cambio visual si falla la red
        Alert.alert('Error', 'No se pudo actualizar el estado del guardia en el servidor');
        return;
      }
      // Llamar a la función para cambiar el estado del usuario
      if (onStartTurn) {
        onStartTurn();
      } else if (onToggleTurn) {
        onToggleTurn();
      }
      fetchRounds(); // Recargar lista para mostrar el nuevo inicio desde el servidor
      setIsActive(true); // Cambia el estado local inmediatamente
    }
  };

  // Calcular rondas completadas hoy (excluyendo inicio/fin de turno y rondas locales de UI)
  const completedRoundsCount = rounds.filter(r => 
    r.status === RoundStatus.COMPLETED && 
    r.location !== 'Inicio de Turno' && 
    r.location !== 'Fin de Turno'
  ).length;

  // Calcular total de rondas asignadas (excluyendo marcadores)
  const totalRoundsCount = rounds.filter(r => 
    r.location !== 'Inicio de Turno' && 
    r.location !== 'Fin de Turno'
  ).length;

  const processEndTurn = async () => {
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


      // Actualizar estado activo en backend
      try {
        // 1. Primero cerramos el turno en la tabla turnos (para asegurar que se registre la hora)
        const response = await fetch(`${API_URL}/turnos/${turnId}`, {
          method: 'PATCH'
        });
        
        if (!response.ok) {
            // Si el turno no existe (404) porque se borró la BD, permitimos cerrar localmente
            if (response.status === 404) {
              console.warn("Turno no encontrado (404), forzando cierre local.");
            } else {
              const errorData = await response.json();
              throw new Error(errorData.error || "Error al cerrar turno en base de datos");
            }
        }

        // 2. Luego desactivamos al guardia
        await fetch(`${API_URL}/guardias/activo`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rut: user.rut, activo: 0 })
        });
      } catch (e: any) {
        // Revertir cambio visual si falla la red
        Alert.alert('Error', `No se pudo actualizar el estado: ${e.message}`);
        return; // Detenemos la ejecución para no cambiar el estado visual si falló la red
      }
      // Llamar a la función para cambiar el estado del usuario
      if (onToggleTurn) onToggleTurn();
      fetchRounds(); // Recargar lista para mostrar el cierre desde el servidor
      setIsActive(false); // Cambia el estado local inmediatamente
      setCurrentTurnId(null); // Limpiamos el ID del turno actual
  };

  const handleEndTurn = async () => {
    if (isActive) {
      // VALIDACIÓN: Rondas pendientes (Advertencia)
      if (completedRoundsCount < totalRoundsCount) {
        Alert.alert(
          "Rondas Pendientes",
          `Tienes rondas sin completar (${completedRoundsCount}/${totalRoundsCount}).\n\n¿Deseas terminar el turno de todas formas?`,
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Terminar Turno", style: "destructive", onPress: () => processEndTurn() }
          ]
        );
        return;
      }
      await processEndTurn();
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
      // --- CÁLCULO DE TIEMPO (NO BLOQUEANTE) ---
      const now = new Date();
      const [hours, minutes] = pendingRound.time.split(':').map(Number);
      
      let roundTime = new Date();
      if (pendingRound.date) {
        const roundDate = new Date(pendingRound.date);
        if (!isNaN(roundDate.getTime())) roundTime = roundDate;
      }
      roundTime.setHours(hours, minutes, 0, 0);

      const diffMinutes = (now.getTime() - roundTime.getTime()) / 60000;

      // Solo advertimos si es muy temprano, pero permitimos marcar
      if (diffMinutes < -15) {
        Alert.alert("Aviso", `Estás iniciando la ronda ${Math.abs(Math.round(diffMinutes))} minutos antes de lo programado.`);
      }

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
      // No se pudo obtener la ubicación
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
          const title = response.status === 400 ? 'Advertencia' : 'Error de Marcaje';
          const message = response.status === 400 ? (result.error || 'Punto incorrecto') : ('No se pudo guardar en BD: ' + (result.error || 'Error desconocido'));
          Alert.alert(title, message);
        } else {
          // --- CÁLCULO PROPORCIONAL DE TIEMPO ENTRE PUNTOS ---
          let timingMsg = "";
          const currentRound = rounds.find(r => r.id === activeRoundId);
          
          if (currentRound && result.progress) {
            const [h, m] = currentRound.time.split(':').map(Number);
            const roundStart = new Date();
            roundStart.setHours(h, m, 0, 0);
            
            // Asumimos una duración estándar de ronda de 60 min si no hay info, o calculamos proporcional
            // Tiempo estimado por punto = 60 min / total puntos
            const totalPoints = result.progress.total || 1;
            const intervalPerPoint = 60 / totalPoints; 
            
            // El tiempo esperado para ESTE punto es: Inicio Ronda + ( (PuntoActual - 1) * Intervalo )
            const pointIndex = result.progress.current; // 1, 2, 3...
            const expectedMinutesOffset = (pointIndex - 1) * intervalPerPoint;
            const expectedTime = new Date(roundStart.getTime() + expectedMinutesOffset * 60000);
            
            const diff = (new Date().getTime() - expectedTime.getTime()) / 60000;
            
            if (diff > 10) timingMsg = "\n(Marcaje Atrasado)";
            else if (diff < -10) timingMsg = "\n(Marcaje Anticipado)";
          }
          // ---------------------------------------------------

          if (result.roundCompleted) {
            Alert.alert("¡Ronda Completada!", `Has recorrido todos los puntos de control.${timingMsg}`);
            
            // Actualizar UI localmente solo si el servidor confirma que se completó
            setRounds(prevRounds => {
              const newRounds = [...prevRounds];
              const currentIndex = newRounds.findIndex(r => r.id === activeRoundId);
              
              if (currentIndex !== -1) {
                newRounds[currentIndex] = {
                  ...newRounds[currentIndex],
                  status: RoundStatus.COMPLETED,
                  completedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
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
            Alert.alert("Punto Registrado", `Marcaje correcto.${timingMsg}\nContinúa con los siguientes puntos. ${progressText}`);
            
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
        Alert.alert('Error', 'Fallo de conexión al guardar el marcaje.');
      }

      setActiveRoundId(null);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5, // Calidad media para no saturar la red
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewLogPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  };

  const handleAddLog = () => {
    if (!newLogDesc.trim()) return;

    const newEntry: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: new Date().toLocaleDateString(),
      type: newLogType,
      description: newLogDesc,
      author: `${user.nombre} ${user.apellido}`
    };

    setLogs([newEntry, ...logs]);
    saveBitacora(newLogType, newLogDesc, newLogPhoto); // Guardar en backend con foto
    setNewLogDesc('');
    setNewLogPhoto(null);
    setShowAddModal(false);
  };

  const handleNoObservations = () => {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
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

  // Lógica directa de pánico (sin alerta de confirmación previa, ya que el HoldButton actúa como confirmación)
  const executePanicAlert = async () => {
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
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error desconocido del servidor');
        } else {
            throw new Error('El servidor respondió con un error inesperado.');
        }
      }
    } catch (error: any) { Alert.alert("Error", `No se pudo enviar la alerta: ${error.message}`); }
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
          onPress: executePanicAlert,
          style: "destructive"
        }
      ]
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <Header
        user={{
          ...user,
          isActive: isActive,
          name: `${user.nombre} ${user.apellido} \n ${puesto ? `${puesto.puesto} - ${puesto.instalaciones}` : 'Sin Puesto'}`,
          avatar: avatarUrl
        }}
        notificationCount={unreadCount}
        onProfilePress={() => { setShowProfileModal(true); }}
        onNotificationsPress={() => { fetchMessages(); setShowMessagesModal(true); }}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={showProfileModal}
        onRequestClose={() => { setShowProfileModal(false); setDebugTapCount(0); }}
      >
        <View className="flex-1 justify-center items-center bg-black/80 p-6">
          <View className={`w-full max-w-md rounded-3xl p-8 shadow-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <TouchableWithoutFeedback onPress={() => setDebugTapCount(prev => prev + 1)}>
              <Image
                source={{ uri: avatarUrl }}
                className="w-24 h-24 rounded-full mb-4 border-4 border-emerald-500"
              />
            </TouchableWithoutFeedback>
            <Text className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.nombre} {user.apellido}</Text>
            <Text className="text-sm text-slate-500 mb-4 text-center">{user.role || 'Guardia'}</Text>
            
            {/* Toggle de Tema en el Perfil */}
            <TouchableOpacity 
              onPress={toggleTheme}
              className={`flex-row items-center gap-2 px-4 py-2 rounded-full mb-6 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
            >
              <MaterialIcons name={isDark ? "light-mode" : "dark-mode"} size={20} color={isDark ? "#fbbf24" : "#64748b"} />
              <Text className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</Text>
            </TouchableOpacity>

            <View className="w-full gap-3 mb-4">
              <Text className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}><Text className="font-bold">RUT:</Text> {user.rut}</Text>
              <Text className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}><Text className="font-bold">Puesto:</Text> {puesto ? puesto.puesto : 'No seleccionado'}</Text>
            </View>
            <View className="flex-row gap-4 mb-4 w-full">
              <TouchableOpacity
                onPress={() => { setShowProfileModal(false); setDebugTapCount(0); }}
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
                    setShowProfileModal(false); setDebugTapCount(0);
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

            {/* Botón de Reset de Emergencia (OCULTO: Requiere 5 toques en la foto) */}
            {debugTapCount >= 5 && (
              <TouchableOpacity
                  onPress={handleEmergencyReset}
                  className="w-full py-3 rounded-xl items-center mt-2 border border-orange-200 bg-orange-50"
              >
                  <Text className="text-orange-600 font-bold text-xs">Restablecer Estado (Solucionar Error)</Text>
              </TouchableOpacity>
            )}
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
        {offlineQueue.length > 0 && (
          <View className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4 flex-row items-center justify-between shadow-sm">
            <View className="flex-row items-center gap-2">
              <View className="bg-orange-100 p-1.5 rounded-full">
                <MaterialIcons name="cloud-off" size={16} color="#ea580c" />
              </View>
              <Text className="text-orange-800 font-bold text-xs">
                {offlineQueue.length} registros por sincronizar
              </Text>
            </View>
            <TouchableOpacity onPress={() => processQueue()} disabled={refreshing}>
              <Text className="text-orange-600 font-bold text-xs bg-orange-100 px-3 py-1.5 rounded-lg overflow-hidden">Sincronizar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Section */}
        <View className="flex-row gap-3 mb-6">
          <View className={`flex-1 p-4 rounded-2xl shadow-sm border items-center justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Estado</Text>
            <Text className={`text-lg font-bold ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={handleCheck}
            disabled={checkDisabled || !isActive}
            className={`flex-1 p-4 rounded-2xl shadow-sm border items-center justify-center ${isDark ? 'border-slate-700' : 'border-slate-100'} ${
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
          <HoldButton
            onActivate={handleStartTurn}
            disabled={isActive}
            duration={2000}
            fillColor="rgba(59, 130, 246, 0.2)"
            className={`flex-1 rounded-3xl border h-36 ${
              !isActive
                ? (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100')
                : 'bg-slate-100 border-transparent opacity-50'
            }`}
          >
            <View className="p-5 justify-between h-full w-full">
              <View className="absolute -top-2 -right-2 w-20 h-20 rounded-full bg-blue-500/5 z-0" />
              <MaterialIcons name="play-circle-outline" size={40} color={!isActive ? '#3b82f6' : '#94a3b8'} />
              <View>
                <Text className={`font-bold text-lg leading-tight z-10 ${isDark ? 'text-white' : 'text-slate-900'}`}>Comenzar Turno</Text>
                {!isActive && (
                  <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Mantén para confirmar</Text>
                )}
              </View>
            </View>
          </HoldButton>
          
          <HoldButton
            onActivate={handleEndTurn}
            disabled={!isActive}
            duration={2000}
            fillColor="rgba(239, 68, 68, 0.2)"
            className={`flex-1 rounded-3xl border h-36 ${
              isActive
                ? 'bg-red-50 border-red-200'
                : 'bg-slate-100 border-transparent opacity-50'
            }`}
          >
            <View className="p-5 justify-between h-full w-full">
              <View className="absolute -top-2 -right-2 w-20 h-20 rounded-full bg-red-500/10 z-0" />
              <MaterialIcons name="stop-circle" size={40} color={isActive ? '#ef4444' : '#fca5a5'} />
              <View>
                <Text className="font-bold text-lg leading-tight text-red-600 z-10">Terminar Turno</Text>
                {isActive ? (
                  <Text className={`text-[10px] font-bold mt-1 ${completedRoundsCount >= totalRoundsCount ? 'text-emerald-600' : 'text-red-400'}`}>
                    {completedRoundsCount >= totalRoundsCount 
                      ? 'Rondas completas' 
                      : `Faltan rondas (${completedRoundsCount}/${totalRoundsCount})`}
                  </Text>
                ) : (
                  <Text className="text-[10px] text-red-400 font-medium mt-1">Mantén para confirmar</Text>
                )}
              </View>
            </View>
          </HoldButton>
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

            <HoldButton 
              onActivate={executePanicAlert}
              duration={3000}
              fillColor="rgba(255, 255, 255, 0.3)"
              className="flex-1 relative overflow-hidden rounded-3xl bg-red-700 p-5 shadow-lg flex-row items-center justify-center h-24 min-w-[140px] max-w-[220px]"
            >
              <View className="flex-row items-center z-10 gap-2 w-full h-full justify-center">
                <MaterialIcons name="emergency-share" size={28} color="white" />
                <View className="flex-col items-start">
                  <Text className="font-bold text-white text-xl">Botón Pánico</Text>
                  <Text className="text-red-100 text-xs font-medium mt-1">Mantén 3 seg</Text>
                </View>
              </View>
              <View className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
            </HoldButton>
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
        <View className={`rounded-t-[40px] shadow-2xl border-t -mx-4 px-6 pt-6 pb-20 min-h-[400px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <View className={`flex-row items-center justify-between border-b mb-4 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            <View className="flex-row">
              <TouchableOpacity 
                onPress={() => setActiveTab('RONDAS')}
                className={`mr-6 pb-3 border-b-2 items-center ${
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
                className={`mr-6 pb-3 border-b-2 items-center ${
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
            
            {activeTab === 'RONDAS' && (
               <View className={`flex-row rounded-lg p-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <TouchableOpacity 
                    onPress={() => setPeriodFilter('hoy')}
                    className={`px-3 py-1 rounded-md ${periodFilter === 'hoy' ? (isDark ? 'bg-slate-600' : 'bg-white shadow-sm') : ''}`}
                  >
                    <Text className={`text-xs font-bold ${periodFilter === 'hoy' ? (isDark ? 'text-white' : 'text-slate-700') : 'text-slate-400'}`}>Hoy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setPeriodFilter('semana')}
                    className={`px-3 py-1 rounded-md ${periodFilter === 'semana' ? (isDark ? 'bg-slate-600' : 'bg-white shadow-sm') : ''}`}
                  >
                    <Text className={`text-xs font-bold ${periodFilter === 'semana' ? (isDark ? 'text-white' : 'text-slate-700') : 'text-slate-400'}`}>Semana</Text>
                  </TouchableOpacity>
               </View>
            )}
          </View>

          <View className="gap-4">
            {activeTab === 'RONDAS' ? (
              <View className="gap-4">
                {/* Banner de Turno Extra / Rondas Pendientes */}
                {rounds.some(r => r.status === RoundStatus.PENDING) && (
                  <View className={`p-4 rounded-2xl border mb-2 shadow-sm ${isDark ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'}`}>
                    <View className="flex-row items-start gap-3">
                      <View className="bg-amber-500 w-10 h-10 rounded-full items-center justify-center shadow-sm mt-1">
                        <MaterialIcons name="notification-important" size={24} color="white" />
                      </View>
                      <View className="flex-1">
                        <Text className={`font-bold text-base mb-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                          Rondas Pendientes ({rounds.filter(r => r.status === RoundStatus.PENDING).length})
                        </Text>
                        <View className="gap-1">
                          {rounds.filter(r => r.status === RoundStatus.PENDING).map((r) => (
                            <View key={r.id} className="flex-row items-start mb-2">
                              <MaterialIcons name="schedule" size={14} color={isDark ? '#fcd34d' : '#b45309'} style={{ marginTop: 2, marginRight: 6 }} />
                              <View>
                                <Text className={`text-xs font-bold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                                  {r.time} hrs - {r.location}
                                </Text>
                                {puesto && (
                                  <Text className={`text-[10px] ${isDark ? 'text-amber-300/80' : 'text-amber-700/80'}`}>
                                    {puesto.puesto} • {puesto.instalaciones}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                )}
                {rounds.map(round => (
                  <RoundItem key={round.id} round={round} onStart={() => handleStartRound(round.id)} />
                ))}
                {rounds.length === 0 && <Text className="text-center text-slate-400 py-8">No hay rondas registradas para este periodo.</Text>}
              </View>
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
          <View className={`w-full rounded-3xl p-6 shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <Text className={`text-xl font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Registro de Observaciones</Text>
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
          <View className={`w-full rounded-t-[32px] p-6 shadow-2xl h-[70%] ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Nuevo Evento</Text>
              <TouchableOpacity 
                onPress={() => setShowAddModal(false)}
                className={`w-8 h-8 items-center justify-center rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
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
                          : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${newLogType === type ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-500')}`}>
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
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 16,
                    fontSize: 14,
                    minHeight: 120,
                    color: isDark ? '#fff' : '#1e293b',
                    textAlignVertical: 'top'
                  }}
                />
              </View>

              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Evidencia (Opcional)</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity 
                    onPress={handlePickImage}
                    className={`p-4 rounded-xl items-center justify-center border w-20 h-20 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}
                  >
                    <MaterialIcons name="camera-alt" size={24} color="#64748b" />
                    <Text className="text-[10px] text-slate-500 mt-1">Foto</Text>
                  </TouchableOpacity>
                  
                  {newLogPhoto && (
                    <View className="relative w-20 h-20">
                      <Image source={{ uri: newLogPhoto }} className="w-full h-full rounded-xl" />
                      <TouchableOpacity 
                        onPress={() => setNewLogPhoto(null)}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center border-2 border-white"
                      >
                        <MaterialIcons name="close" size={14} color="white" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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
        <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <View className={`p-4 border-b flex-row justify-between items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Mensajes</Text>
            <TouchableOpacity onPress={() => setShowMessagesModal(false)} className={`p-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
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
                <View key={msg.id_mensaje} className={`mb-4 p-4 rounded-2xl max-w-[85%] ${msg.emisor === 'GUARDIA' ? (isDark ? 'bg-indigo-900 self-end rounded-tr-none' : 'bg-indigo-100 self-end rounded-tr-none') : (isDark ? 'bg-slate-800 self-start rounded-tl-none border border-slate-700' : 'bg-white self-start rounded-tl-none border border-slate-200')}`}>
                  <Text className={`text-xs font-bold mb-1 ${msg.emisor === 'GUARDIA' ? (isDark ? 'text-indigo-300' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                    {msg.emisor === 'GUARDIA' ? 'Tú' : 'Supervisor'} • {new Date(msg.fecha_hora).toLocaleString()}
                  </Text>
                  <Text className={`${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{msg.contenido}</Text>
                  {msg.emisor === 'GUARDIA' && (
                    <View className="items-end mt-1">
                      <MaterialIcons name="done-all" size={16} color={(msg.leido === 1 || msg.leido === true) ? "#2563eb" : "#94a3b8"} />
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>

          <View className={`p-4 border-t ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <View className="flex-row gap-2 items-center">
              <TextInput
                value={replyBody}
                onChangeText={setReplyBody}
                placeholder="Escribe una respuesta..."
                placeholderTextColor={isDark ? '#94a3b8' : '#9ca3af'}
                className={`flex-1 p-3 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`}
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
          <View className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl items-center border-2 ${isDark ? 'bg-slate-800 border-red-900' : 'bg-white border-red-50'}`}>
            <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="notifications-active" size={40} color="#ef4444" />
            </View>
            <Text className="text-2xl font-bold text-red-600 mb-2 text-center">¡Alerta Enviada!</Text>
            <Text className={`text-center mb-8 text-base px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
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
  const { isDark } = useTheme();
  const getTypeColor = () => {
    switch(log.type) {
      case 'INCIDENCIA': return 'bg-red-500';
      case 'OBSERVACION': return 'bg-amber-500';
      case 'NOTIFICACION':
      default: return 'bg-blue-500';
    }
  };

  return (
    <View className={`border rounded-3xl p-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View className={`w-2 h-2 rounded-full ${getTypeColor()}`} />
          <Text className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">{log.type}</Text>
        </View>
        <Text className="text-[10px] font-medium text-slate-400">{log.date} {log.timestamp}</Text>
      </View>
      <Text className={`text-sm leading-relaxed mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{log.description}</Text>
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
  const { isDark } = useTheme();
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
      // Error cargando puntos
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
          bg: isDark ? 'bg-emerald-900/30' : 'bg-emerald-50',
          text: isDark ? 'text-emerald-400' : 'text-emerald-600',
          bar: 'bg-emerald-500',
          border: isDark ? 'border-emerald-900' : 'border-emerald-100'
        };
      case RoundStatus.PENDING:
        return {
          icon: 'schedule' as const,
          bg: isDark ? 'bg-blue-900/30' : 'bg-blue-50',
          text: isDark ? 'text-blue-400' : 'text-blue-600',
          bar: 'bg-blue-500',
          border: isDark ? 'border-blue-900' : 'border-blue-100'
        };
      case RoundStatus.SCHEDULED:
      default:
        return {
          icon: 'lock-clock' as const,
          bg: isDark ? 'bg-slate-800' : 'bg-slate-50',
          text: 'text-slate-400',
          bar: 'bg-slate-300',
          border: isDark ? 'border-slate-700' : 'border-slate-100'
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

  // @ts-ignore
  const totalPoints = round.totalPoints || 0;
  // @ts-ignore
  const markedPoints = round.markedPoints || 0;
  const progressPercent = totalPoints > 0 ? (markedPoints / totalPoints) * 100 : 0;

  return (
    <TouchableOpacity 
      onPress={toggleExpand}
      activeOpacity={0.9}
      className={`p-5 rounded-[24px] shadow-sm border mb-3 ${isDark ? 'bg-slate-900' : 'bg-white'} ${config.border} ${round.status === RoundStatus.SCHEDULED ? 'opacity-70' : ''}`}
    >
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          <View className={`w-10 h-10 rounded-2xl ${config.bg} items-center justify-center`}>
            <MaterialIcons name={config.icon} size={20} color={config.text.includes('slate') ? '#94a3b8' : config.text.includes('emerald') ? (isDark ? '#34d399' : '#059669') : (isDark ? '#60a5fa' : '#2563eb')} />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{round.location}</Text>
            <Text className="text-xs text-slate-400 font-medium mt-0.5">
              {round.time} {round.completedTime ? `→ ${round.completedTime}` : ''}
            </Text>
          </View>
        </View>
        
        <View className={`px-2.5 py-1 rounded-full ${config.bg}`}>
           <Text className={`text-[10px] font-bold ${config.text}`}>{statusText}</Text>
        </View>
      </View>

      {!isLocalRound && totalPoints > 0 && (
        <View className="mb-3">
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progreso</Text>
            <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{markedPoints}/{totalPoints}</Text>
          </View>
          <View className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <View 
              className={`h-full rounded-full ${config.bar}`} 
              style={{ width: `${progressPercent}%` }} 
            />
          </View>
        </View>
      )}

      {!isLocalRound && (
         <View className="items-center -mb-2">
            <MaterialIcons name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={20} color={isDark ? "#334155" : "#e2e8f0"} />
         </View>
      )}

      {expanded && (
        <View className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {loading ? (
            <Text className="text-center text-slate-400 text-xs py-2">Cargando puntos...</Text>
          ) : (
            <View className="gap-2">
              {points.map((point, index) => {
                // Cálculo de Hora Ideal
                let idealTimeStr = "--:--";
                let isLate = false;
                
                if (round.time) {
                  const [h, m] = round.time.split(':').map(Number);
                  const baseDate = new Date();
                  baseDate.setHours(h, m, 0, 0);
                  
                  // Usamos 60 min como duración estándar o calculamos si tuviéramos hora fin
                  // @ts-ignore
                  const total = round.totalPoints || points.length || 1;
                  const interval = 60 / total;
                  const offset = index * interval;
                  
                  const idealDate = new Date(baseDate.getTime() + offset * 60000);
                  idealTimeStr = idealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                  // Verificar atraso si está marcado
                  if (point.marcado && point.hora_marcaje) {
                     const markedDate = new Date(point.hora_marcaje);
                     // Comparamos solo tiempos del día actual para simplificar
                     const markedTime = new Date();
                     markedTime.setHours(markedDate.getHours(), markedDate.getMinutes(), 0, 0);
                     
                     const idealTimeToday = new Date();
                     idealTimeToday.setHours(idealDate.getHours(), idealDate.getMinutes(), 0, 0);
                     
                     const diff = (markedTime.getTime() - idealTimeToday.getTime()) / 60000;
                     if (diff > 10) isLate = true;
                  }
                }

                return (
                  <View key={index} className={`flex-row items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className={`w-2 h-2 rounded-full ${point.marcado ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')}`} />
                      <View className="flex-1">
                        <Text className={`text-xs font-bold ${point.marcado ? (isDark ? 'text-slate-200' : 'text-slate-700') : 'text-slate-500'}`}>{point.nombre}</Text>
                        <View className="flex-row items-center gap-2">
                          {point.descripcion ? <Text className="text-[10px] text-slate-400" numberOfLines={1}>{point.descripcion}</Text> : null}
                          <Text className="text-[10px] text-slate-400 italic">Ideal: {idealTimeStr}</Text>
                        </View>
                      </View>
                    </View>
                    {point.marcado ? (
                      <View className="items-end">
                        <View className={`flex-row items-center gap-1 px-2 py-1 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                          <MaterialIcons name="check-circle" size={12} color="#10b981" />
                          <Text className="text-[10px] font-medium text-emerald-600">
                            {new Date(point.hora_marcaje).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </Text>
                        </View>
                        {isLate && (
                          <Text className="text-[9px] text-red-500 font-bold mt-0.5">Atrasado</Text>
                        )}
                      </View>
                    ) : (
                      <Text className="text-[10px] font-medium text-slate-400 italic">Pendiente</Text>
                    )}
                  </View>
                );
              })}
              {points.length === 0 && <Text className="text-center text-slate-400 text-xs">No hay puntos de control asignados.</Text>}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default Dashboard;
