// app/Screens/Vitals/Vitals.jsx
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft, Heart, Thermometer, Wind,
  Wifi, WifiOff, Footprints, Activity, BarChart2, Zap,
} from "lucide-react-native";
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Footer from "../components/Footer";
import { useWearData } from '../../../hooks/useWearData';
import { API_BASE_URL } from '../../constants/constants';

const { width } = Dimensions.get("window");

const TEN_MINUTES = 10 * 60 * 1000;

const getBMIStatus = (bmi) => {
  if (!bmi) return { label: 'N/A', color: '#6B7280', bg: '#F3F4F6' };
  const val = parseFloat(bmi);
  if (val < 18.5) return { label: 'Underweight', color: '#F59E0B', bg: '#FEF3C7' };
  if (val < 25)   return { label: 'Normal',      color: '#10B981', bg: '#D1FAE5' };
  if (val < 30)   return { label: 'Overweight',  color: '#F97316', bg: '#FFEDD5' };
  return           { label: 'Obese',             color: '#EF4444', bg: '#FEE2E2' };
};

const getRHRStatus = (rhr) => {
  if (!rhr) return { label: 'N/A', color: '#6B7280' };
  if (rhr < 60)   return { label: 'Athletic', color: '#3B82F6' };
  if (rhr <= 100) return { label: 'Normal',   color: '#10B981' };
  return           { label: 'High',           color: '#EF4444' };
};

const getAccelColor = (intensity) => {
  switch (intensity) {
    case 'Still':    return '#6B7280';
    case 'Light':    return '#10B981';
    case 'Moderate': return '#F59E0B';
    case 'Active':   return '#EF4444';
    default:         return '#6B7280';
  }
};

export default function Vitals() {
  const router = useRouter();
  const {
    heartRate,
    lastHeartRateTime,
    lastSyncedTime,
    spo2,
    steps,
    restingHeartRate,
    bmi,
    accelerometer,
    askPermissions,
  } = useWearData();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isWatchConnected, setIsWatchConnected] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null); // null = no saved data yet
  const [patientTemperature, setPatientTemperature] = useState(null); // FIX 3: from profile
  const [vitals, setVitals] = useState({
    heartRate: 0,
    oxygenLevel: 0,
    footsteps: 0,
    restingHeartRate: 0,
    bmi: null,
    // FIX 5: Accelerometer default zero for new users
    accelerometer: { x: 0, y: 0, z: 0, intensity: 'Still' },
  });
// ✅ Mount pe sab reset
useEffect(() => {
  const init = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      router.replace('/Screens/SignIn/SignIn');
      return;
    }
    setVitals({
      heartRate: 0,
      oxygenLevel: 0,
      footsteps: 0,
      restingHeartRate: 0,
      bmi: null,
      accelerometer: { x: 0, y: 0, z: 0, intensity: 'Still' },
    });
    setLastSavedData(null);
    setPatientTemperature(null);
  };
  init();
}, []);
  // ─── FIX 3: Fetch patient profile temperature ──────────────────────────────
  useEffect(() => {
    const fetchPatientProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success && data.data?.temperature) {
          setPatientTemperature(parseFloat(data.data.temperature));
        }
      } catch (error) {
        console.log('Profile fetch error:', error);
      }
    };
    fetchPatientProfile();
  }, []);

  // ─── Watch connected check ─────────────────────────────────────────────────
  useEffect(() => {
  const checkConnection = () => {
    if (heartRate && lastHeartRateTime) {
      const diffMs = new Date() - new Date(lastHeartRateTime);
      const isRecent = diffMs < TEN_MINUTES;
      setIsWatchConnected(isRecent);

      // ✅ Sirf merge karo, zero pe reset nahi
      setVitals((prev) => ({
        ...prev,
        heartRate:        heartRate        || prev.heartRate,
        oxygenLevel:      spo2             || prev.oxygenLevel,
        footsteps:        steps            || prev.footsteps,
        restingHeartRate: restingHeartRate || prev.restingHeartRate,
        bmi:              bmi              || prev.bmi,
        accelerometer:    accelerometer    || prev.accelerometer,
      }));

      if (isRecent) {
        saveVitalsToBackend(heartRate, spo2 || 0, steps || 0, restingHeartRate || 0);
      } else {
        fetchLastSavedVitals();
      }
    } else {
      setIsWatchConnected(false);
      fetchLastSavedVitals();
    }
  };
  checkConnection();
}, [heartRate, lastHeartRateTime, spo2, steps, restingHeartRate, bmi, accelerometer]);

  // ─── Refresh connected status every minute ─────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastHeartRateTime) {
        const diffMs = new Date() - new Date(lastHeartRateTime);
        setIsWatchConnected(diffMs < TEN_MINUTES);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [lastHeartRateTime]);

  // ─── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveVitalsToBackend = async (hr, oxygen, stepsCount, rhr) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_BASE_URL}/api/vitals/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          heartRate: hr,
          bloodOxygen: oxygen,
          footsteps: stepsCount,
          restingHeartRate: rhr,
        }),
      });
    } catch (error) { console.log('Save error:', error); }
  };

  const fetchLastSavedVitals = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_BASE_URL}/api/vitals/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setLastSavedData(data.data); // only set if actual data exists
        setVitals((prev) => ({
          ...prev,
          heartRate: data.data.heartRate || prev.heartRate,
          oxygenLevel: data.data.bloodOxygen || prev.oxygenLevel,
          footsteps: data.data.footsteps || prev.footsteps,
          restingHeartRate: data.data.restingHeartRate || prev.restingHeartRate,
        }));
      }
      // FIX 1: If no data → lastSavedData stays null → no timestamp shown
    } catch (error) { console.log('Fetch error:', error); }
  };

  const formatTime = () =>
    currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatLastSavedTime = (timestamp) => {
  if (!timestamp) return '';
  
  // ✅ Pakistan timezone explicitly set karo
  return new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',   // ← yahi fix hai
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

  // FIX 1: displayTimestamp only shows if actual saved data exists
  const displayTimestamp = lastSyncedTime ?? lastSavedData?.timestamp ?? null;

  const bmiStatus = getBMIStatus(vitals.bmi);
  const rhrStatus = getRHRStatus(vitals.restingHeartRate);
  const accelColor = getAccelColor(vitals.accelerometer?.intensity);

  // FIX 3: Temperature display — profile value or '--' for new user
  const temperatureDisplay = patientTemperature
    ? patientTemperature.toFixed(1)
    : '--';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Vitals</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={askPermissions} style={styles.allowButton}>
            <Text style={styles.allowButtonText}>Allow</Text>
          </TouchableOpacity>
          {isWatchConnected
            ? <Wifi size={20} color="#10B981" />
            : <WifiOff size={20} color="#EF4444" />
          }
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* FIX 1: Offline banner — only show when watch disconnected AND saved data exists */}
        {!isWatchConnected && lastSavedData && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color="#fff" />
            <Text style={styles.offlineBannerText}>
              Watch Not Connected — Showing Last Saved Data
            </Text>
          </View>
        )}

        {/* FIX 1: Timestamp banner — only show if saved data exists */}
        {displayTimestamp && (
          <View style={styles.timestampBanner}>
            <Text style={styles.timestampText}>
              📅 Last saved: {formatLastSavedTime(displayTimestamp)}
            </Text>
          </View>
        )}

        {/* Heart Rate Card */}
        <View style={styles.heartRateCard}>
          <View style={styles.heartRateHeader}>
            <View style={styles.heartRateTitleRow}>
              <Heart size={20} color="#EF4444" />
              <Text style={styles.heartRateTitle}>Heart Rate</Text>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: isWatchConnected ? '#D1FAE5' : '#FEE2E2'
            }]}>
              <View style={[styles.statusDot, {
                backgroundColor: isWatchConnected ? '#10B981' : '#EF4444'
              }]} />
              <Text style={[styles.statusBadgeText, {
                color: isWatchConnected ? '#10B981' : '#EF4444'
              }]}>
                {isWatchConnected ? 'Live' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.heartRateDisplay}>
            <Text style={styles.heartRateValue}>{Math.round(vitals.heartRate) || 0}</Text>
            <Text style={styles.heartRateUnit}>BPM</Text>
          </View>

          {/* FIX 2: "Data until:" row completely removed */}
        </View>

        {/* Temperature & Oxygen */}
        <View style={styles.statsGrid}>
          {/* FIX 3: Temperature from patient profile */}
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <View style={styles.statIconContainer}>
              <Thermometer size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{temperatureDisplay}°</Text>
            <Text style={styles.statLabel}>Temperature</Text>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>
                {patientTemperature ? 'Profile' : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <View style={styles.statIconContainer}>
              <Wind size={24} color="#3B82F6" />
            </View>
            <View style={styles.oxygenDisplay}>
              <Text style={styles.statValue}>{Math.round(vitals.oxygenLevel) || 0}</Text>
              <Text style={styles.percentSymbol}>%</Text>
            </View>
            <Text style={styles.statLabel}>Oxygen Level</Text>
            <View style={[styles.progressBar, { backgroundColor: '#93C5FD' }]}>
              <View style={[styles.progressFill, {
                width: `${vitals.oxygenLevel || 0}%`,
                backgroundColor: '#3B82F6',
              }]} />
            </View>
          </View>
        </View>

        {/* Footsteps */}
        <View style={styles.footstepsRow}>
          <View style={[styles.footstepsCard, { backgroundColor: '#F0FDF4' }]}>
            <View style={styles.footstepsLeft}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                <Footprints size={24} color="#10B981" />
              </View>
              <View style={styles.footstepsTextBlock}>
                <Text style={styles.footstepsValue}>{(vitals.footsteps || 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Footsteps Today</Text>
              </View>
            </View>
            <View style={[styles.statBadge, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <Text style={[styles.statBadgeText, { color: '#10B981' }]}>Steps</Text>
            </View>
          </View>
        </View>

        {/* Resting HR & BMI */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <View style={styles.statIconContainer}>
              <Activity size={24} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>
              {vitals.restingHeartRate ? Math.round(vitals.restingHeartRate) : '--'}
            </Text>
            <Text style={styles.statLabel}>Resting HR</Text>
            <View style={[styles.statBadge, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <Text style={[styles.statBadgeText, { color: rhrStatus.color }]}>{rhrStatus.label}</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>BPM</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: bmiStatus.bg }]}>
            <View style={styles.statIconContainer}>
              <BarChart2 size={24} color={bmiStatus.color} />
            </View>
            <Text style={styles.statValue}>{vitals.bmi ? vitals.bmi.toFixed(1) : '--'}</Text>
            <Text style={styles.statLabel}>BMI</Text>
            <View style={[styles.statBadge, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <Text style={[styles.statBadgeText, { color: bmiStatus.color }]}>{bmiStatus.label}</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>kg/m²</Text>
          </View>
        </View>

        {/* FIX 5: Accelerometer — default zeros for new user, real data when watch connects */}
        <View style={styles.footstepsRow}>
          <View style={[styles.accelCard, { backgroundColor: '#F5F3FF' }]}>
            <View style={styles.accelHeader}>
              <View style={styles.footstepsLeft}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                  <Zap size={24} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={styles.accelTitle}>Accelerometer</Text>
                  <Text style={styles.statLabel}>Body Movement</Text>
                </View>
              </View>
              <View style={[styles.statBadge, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                <Text style={[styles.statBadgeText, { color: accelColor }]}>
                  {vitals.accelerometer?.intensity || 'Still'}
                </Text>
              </View>
            </View>

            <View style={styles.accelAxesRow}>
              {[
                { label: 'X', color: '#EF4444', val: vitals.accelerometer?.x ?? 0 },
                { label: 'Y', color: '#10B981', val: vitals.accelerometer?.y ?? 0 },
                { label: 'Z', color: '#3B82F6', val: vitals.accelerometer?.z ?? 0 },
              ].map((axis, i) => (
                <React.Fragment key={axis.label}>
                  {i > 0 && <View style={styles.accelAxisDivider} />}
                  <View style={styles.accelAxis}>
                    <Text style={[styles.accelAxisLabel, { color: axis.color }]}>{axis.label}</Text>
                    <Text style={styles.accelAxisValue}>{axis.val.toFixed(2)}</Text>
                    <Text style={styles.accelUnit}>m/s²</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <View style={styles.intensityBarContainer}>
              <View style={styles.intensityBarBg}>
                <View style={[styles.intensityBarFill, {
                  width: vitals.accelerometer?.intensity === 'Still'    ? '5%'  :
                         vitals.accelerometer?.intensity === 'Light'    ? '33%' :
                         vitals.accelerometer?.intensity === 'Moderate' ? '66%' : '95%',
                  backgroundColor: accelColor,
                }]} />
              </View>
              <View style={styles.intensityLabels}>
                {['Still', 'Light', 'Moderate', 'Active'].map((l) => (
                  <Text key={l} style={styles.intensityLabelText}>{l}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* FIX 6: Bottom status card — no last date for new/disconnected users without data */}
        <View style={[styles.statusCard, {
          backgroundColor: isWatchConnected ? '#D1FAE5' : '#FEE2E2'
        }]}>
          <View style={styles.statusIcon}>
            <Heart size={32} color={isWatchConnected ? '#10B981' : '#EF4444'} />
          </View>
          <Text style={[styles.statusTitle, {
            color: isWatchConnected ? '#10B981' : '#EF4444'
          }]}>
            {isWatchConnected ? 'Watch Connected — Live' : 'Watch Disconnected'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {isWatchConnected
              ? `Live data — updated at ${formatTime()}`
              : displayTimestamp
                ? `Last data: ${formatLastSavedTime(displayTimestamp)}`
                : 'Connect your watch to see live vitals'}
          </Text>
        </View>

      </ScrollView>
      <Footer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  allowButton: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6',
  },
  allowButtonText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 12 },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  offlineBannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  timestampBanner: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  timestampText: { color: '#92400E', fontSize: 12, fontWeight: '500' },
  scrollView: { flex: 1 },
  heartRateCard: {
    backgroundColor: '#1F2937', borderRadius: 16, padding: 20, margin: 16, marginBottom: 12,
    elevation: 4,
  },
  heartRateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heartRateTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heartRateTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  heartRateDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  heartRateValue: { fontSize: 72, fontWeight: 'bold', color: '#FFFFFF' },
  heartRateUnit: { fontSize: 20, fontWeight: '600', color: '#9CA3AF' },
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', elevation: 2 },
  statIconContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 8 },
  statBadge: { backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statBadgeText: { fontSize: 11, fontWeight: '600', color: '#10B981' },
  oxygenDisplay: { flexDirection: 'row', alignItems: 'flex-start' },
  percentSymbol: { fontSize: 20, fontWeight: '600', color: '#111827', marginLeft: 2 },
  progressBar: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  footstepsRow: { paddingHorizontal: 16, marginBottom: 12 },
  footstepsCard: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  footstepsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footstepsTextBlock: { flexDirection: 'column' },
  footstepsValue: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  accelCard: { borderRadius: 16, padding: 16, elevation: 2 },
  accelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  accelTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  accelAxesRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, paddingVertical: 16, marginBottom: 16,
  },
  accelAxis: { alignItems: 'center', flex: 1 },
  accelAxisDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  accelAxisLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  accelAxisValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  accelUnit: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  intensityBarContainer: { gap: 6 },
  intensityBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  intensityBarFill: { height: '100%', borderRadius: 4 },
  intensityLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityLabelText: { fontSize: 10, color: '#9CA3AF' },
  statusCard: {
    borderRadius: 16, padding: 24, marginHorizontal: 16, marginBottom: 12,
    alignItems: 'center', elevation: 2,
  },
  statusIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  statusTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  statusSubtitle: { fontSize: 12, color: '#6B7280' },
});
