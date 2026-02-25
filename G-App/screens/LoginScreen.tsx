import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { formatRut } from '../screens/formatters';
import { useTheme } from '../context/ThemeContext';

const LoginScreen = ({ navigation }) => {
  const { isDark } = useTheme(); // Usar el hook
  const [rut, setRut] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Verificar si ya existe una sesión guardada
    const checkSession = async () => {
      try {
        const session = await AsyncStorage.getItem('userSession');
        if (session) {
          const { user, puesto } = JSON.parse(session);
          if (user) {
            navigation.replace('Dashboard', { user, puesto });
          }
        }
      } catch (error) {
        console.error('Error al verificar la sesión:', error);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    if (!rut || !contrasena) {
      Alert.alert('Error', 'Por favor ingresa tu RUT y contraseña');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, contrasena })
      });
      const data = await response.json();
      if (response.ok) {
        const { guardia, activeTurn, puestoSugerido, puesto } = data;
        let puestoFinal = null;

        // 1. Si el backend nos dice que ya hay un turno activo, usamos esa info (el backend debe devolver el objeto puesto completo en activeTurn o sugerido)
        if (activeTurn && activeTurn.puesto) {
            puestoFinal = activeTurn.puesto;
            Alert.alert('Sesión Restaurada', `Tienes un turno activo en "${puestoFinal.puesto}". Se ha retomado tu puesto automáticamente.`);
        } 
        // 2. Si no hay turno activo, pero el backend sugiere un puesto (Plan A), lo usamos.
        else if (puestoSugerido) {
          puestoFinal = puestoSugerido;
          Alert.alert('Puesto Asignado', `Se te ha asignado automáticamente al puesto "${puestoSugerido.puesto}" según tus rondas de hoy.`);
        }
        // 3. Si tiene un puesto fijo asignado en su perfil (Plan B)
        else if (puesto || guardia.puesto) {
          puestoFinal = puesto || guardia.puesto;
        }

        // 4. Si no hay puesto, permitimos el ingreso (Modo Sin Puesto) en lugar de bloquear
        if (!puestoFinal) {
           // Opcional: Alert.alert('Aviso', 'Ingresando sin puesto específico.');
        }

        // Guardar la sesión en el dispositivo
        try {
          await AsyncStorage.setItem('userSession', JSON.stringify({ user: guardia, puesto: puestoFinal }));
        } catch (error) {
          console.error('Error al guardar la sesión:', error);
        }

        // Navegar pasando el usuario como 'user' para Dashboard
        navigation.replace('Dashboard', { user: guardia, puesto: puestoFinal });
      } else {
        Alert.alert('Acceso denegado', data.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#0f172a' }]}>
      <Text style={[styles.title, isDark && { color: '#fff' }]}>Inicio de Sesión</Text>
      {errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <TextInput
        style={[styles.input, isDark && { backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }]}
        placeholderTextColor={isDark ? '#94a3b8' : '#9ca3af'}
        placeholder="RUT"
        value={rut}
        onChangeText={(text) => setRut(formatRut(text))}
        autoCapitalize="none"
        keyboardType="default"
      />
      <TextInput
        style={[styles.input, isDark && { backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }]}
        placeholderTextColor={isDark ? '#94a3b8' : '#9ca3af'}
        placeholder="Contraseña"
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
      />

      <Button title={loading ? 'Ingresando...' : 'Ingresar'} onPress={handleLogin} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    fontWeight: 'bold',
  },
  errorContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#991b1b',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});

export default LoginScreen;
