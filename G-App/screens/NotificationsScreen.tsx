import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('userSession').then(session => {
      if (session) {
        const { user } = JSON.parse(session);
        setUser(user);
        fetchMessages(user.id_guardia);
      }
    });
  }, []);

  const fetchMessages = async (guardId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/mensajes?id_guardia=${guardId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (msg: any) => {
    if (msg.leido) return;

    try {
      await fetch(`${API_URL}/mensajes/${msg.id_mensaje}`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leido: 1 })
      });
      // Actualizar localmente
      setMessages(prev => prev.map(m => 
        m.id_mensaje === msg.id_mensaje ? { ...m, leido: true } : m
      ));
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, !item.leido && styles.unreadCard]} 
      onPress={() => markAsRead(item)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {!item.leido && <View style={styles.dot} />}
          <Text style={[styles.title, !item.leido && styles.unreadText]}>{item.titulo}</Text>
        </View>
        <Text style={styles.date}>
          {new Date(item.fecha_hora).toLocaleDateString()} {new Date(item.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
        </Text>
      </View>
      <Text style={styles.content}>{item.contenido}</Text>
      <View style={styles.footer}>
        <Text style={styles.author}>De: Supervisor</Text>
        {item.leido ? (
          <MaterialIcons name="mark-email-read" size={16} color="#10b981" />
        ) : (
          <MaterialIcons name="mark-email-unread" size={16} color="#f59e0b" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Notificaciones</Text>
        <TouchableOpacity
          onPress={() => user && fetchMessages(user.id_guardia)}
          style={{ marginLeft: 'auto', padding: 8 }}
        >
          <MaterialIcons name="refresh" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id_mensaje.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => user && fetchMessages(user.id_guardia)} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="notifications-none" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No tienes mensajes nuevos</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 50 },
  backButton: { padding: 8, marginRight: 8 },
  screenTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  list: { padding: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  unreadCard: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 8 },
  title: { fontSize: 16, fontWeight: '600', color: '#334155', flex: 1 },
  unreadText: { color: '#1e40af', fontWeight: '700' },
  date: { fontSize: 11, color: '#94a3b8' },
  content: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  author: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, color: '#94a3b8', fontSize: 16 }
});

export default NotificationsScreen;