import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { formatRut } from '../screens/formatters';

const LoginScreen = ({ navigation }) => {
  const [rut, setRut] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [puestos, setPuestos] = useState([]);
  const [selectedPuesto, setSelectedPuesto] = useState(null);
  const [showPuestoModal, setShowPuestoModal] = useState(false);
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

    // Cargar puestos al iniciar
    const loadPuestos = () => {
      fetch(`${API_URL}/puestos`)
        .then(res => res.json())
        .then(data => {
          setPuestos(data);
          setErrorMsg('');
        })
        .catch(err => setErrorMsg(`Error conectando a ${API_URL}\n${err.message}`));
    };
    loadPuestos();
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
        const { guardia, activeTurn, puestoSugerido } = data;
        let puestoFinal = null;

        // 1. Si el backend nos dice que ya hay un turno activo, forzamos ese puesto.
        if (activeTurn && activeTurn.id_puesto) {
          const puestoActivo = puestos.find((p: any) => p.id_puesto === activeTurn.id_puesto);
          if (puestoActivo) {
            puestoFinal = puestoActivo;
            Alert.alert('Sesión Restaurada', `Tienes un turno activo en "${puestoActivo.puesto}". Se ha retomado tu puesto automáticamente.`);
          }
        } 
        // 2. Si no hay turno activo, pero el backend sugiere un puesto (Plan A), lo usamos.
        else if (puestoSugerido) {
          puestoFinal = puestoSugerido;
          // Actualizamos el estado local para que el selector muestre el puesto asignado.
          setSelectedPuesto(puestoSugerido); 
          Alert.alert('Puesto Asignado', `Se te ha asignado automáticamente al puesto "${puestoSugerido.puesto}" según tus rondas de hoy.`);
        }
        // 3. Si no hay sugerencia, usamos el que el guardia seleccionó manualmente.
        else if (selectedPuesto) {
          puestoFinal = selectedPuesto;
        }

        // 4. Si después de todo no tenemos puesto, es un error (guardia volante que no eligió).
        if (!puestoFinal) {
          Alert.alert('Selección Requerida', 'No tienes un puesto asignado para hoy. Por favor, selecciona uno de la lista para continuar.');
          setShowPuestoModal(true);
          setLoading(false);
          return;
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
    <View style={styles.container}>
      <Text style={styles.title}>Inicio de Sesión</Text>
      {errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="RUT"
        value={rut}
        onChangeText={(text) => setRut(formatRut(text))}
        autoCapitalize="none"
        keyboardType="default"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
      />

      <TouchableOpacity 
        style={styles.selector} 
        onPress={() => setShowPuestoModal(true)}
      >
        <Text style={styles.selectorText}>
          {selectedPuesto ? `${selectedPuesto.puesto} - ${selectedPuesto.instalaciones}` : 'Seleccionar Puesto'}
        </Text>
      </TouchableOpacity>

      <Button title={loading ? 'Ingresando...' : 'Ingresar'} onPress={handleLogin} disabled={loading} />

      <Modal
        visible={showPuestoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPuestoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona tu Puesto</Text>
            <FlatList
              data={puestos}
              keyExtractor={(item) => item.id_puesto.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedPuesto(item);
                    setShowPuestoModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{`${item.puesto} - ${item.instalaciones}`}</Text>
                </TouchableOpacity>
              )}
            />
            <Button title="Cancelar" onPress={() => setShowPuestoModal(false)} color="red" />
          </View>
        </View>
      </Modal>

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
  selector: {
    width: '100%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemText: {
    fontSize: 16,
  },
});

export default LoginScreen;
