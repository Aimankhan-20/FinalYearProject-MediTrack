import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncHealthData } from '../../services/HealthService';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // ✅ Real user profile load karo
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await fetch('http://192.168.1.7:5000/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.user) setUserProfile(data.user);
      } catch (e) {
        console.log('Profile load error:', e.message);
      }
    };
    loadProfile();
  }, []);

  const handleWatchSync = async (type) => {
    if (!userProfile) {
      Alert.alert('Error', 'Profile load nahi hua abhi');
      return;
    }
    setLoading(true);
    try {
      const response = await syncHealthData(userProfile, type);
      if (response && response.success) {
        setPredictionResult(response.data);
        Alert.alert(
          '✅ Saved!',
          `Disease: ${type}\nSeverity: ${response.data.severity}\nRisk Score: ${response.data.risk_score}`
        );
      }
    } catch (error) {
      Alert.alert('Sync Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {userProfile?.name || '...'}</Text>
        <Text style={styles.subText}>Track your health vitals in real-time</Text>
      </View>

      <View style={styles.syncSection}>
        <Text style={styles.sectionTitle}>Live Diagnostic Sync</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: '#FF3B30' }]}
              onPress={() => handleWatchSync('Hypertension')}
            >
              <Text style={styles.buttonText}>Check Hypertension</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: '#007AFF' }]}
              onPress={() => handleWatchSync('TachyBrady')}  // ✅ fix
            >
              <Text style={styles.buttonText}>Check Tachy/Brady</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: '#4CD964' }]}
              onPress={() => handleWatchSync('SleepApnea')}
            >
              <Text style={styles.buttonText}>Check Sleep Apnea</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {predictionResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Last Analysis Result:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Severity:</Text>
            <Text style={[styles.value, {
              color: predictionResult.severity === 'Severe' ? 'red' :
                     predictionResult.severity === 'Moderate' ? 'orange' : 'green'
            }]}>
              {predictionResult.severity}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Risk Score:</Text>
            <Text style={styles.value}>{predictionResult.risk_score}</Text>
          </View>
          <Text style={styles.timestamp}>Last synced: {new Date().toLocaleTimeString()}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EEE' },
  welcomeText: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subText: { fontSize: 14, color: '#666', marginTop: 5 },
  syncSection: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  buttonContainer: { flexDirection: 'column', gap: 10 },
  syncButton: { padding: 15, borderRadius: 12, alignItems: 'center', elevation: 3 },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  resultCard: { margin: 20, padding: 20, backgroundColor: '#FFF', borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#007AFF', elevation: 2 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666' },
  value: { fontWeight: 'bold' },
  timestamp: { fontSize: 10, color: '#AAA', textAlign: 'right', marginTop: 10 }
});

export default Dashboard;