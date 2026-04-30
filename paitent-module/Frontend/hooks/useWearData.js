import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initialize,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { API_BASE_URL } from '../app/constants/constants';

export const getPatientCondition = (heartRate, spo2) => {
  if (!heartRate && !spo2) return 'normal';
  const hr = heartRate || 75;
  const sp = spo2 || 98;
  if (hr > 150 || hr < 40 || sp < 90) return 'critical';
  if (hr > 120 || hr < 50 || sp < 94) return 'abnormal';
  return 'normal';
};

export const getIntervalByCondition = (condition) => {
  switch (condition) {
    case 'critical': return 5  * 60 * 1000;
    case 'abnormal': return 15 * 60 * 1000;
    default:         return 60 * 60 * 1000;
  }
};

// ✅ userId parameter accept karo — jab bhi naya user aaye, hook reset ho
export const useWearData = (userId = null) => {
  const [heartRate,         setHeartRate]         = useState(null);
  const [lastHeartRateTime, setLastHeartRateTime] = useState(null);
  const [spo2,              setSpo2]              = useState(null);
  const [steps,             setSteps]             = useState(null);
  const [restingHeartRate,  setRestingHeartRate]  = useState(null);
  const [bmi,               setBmi]               = useState(null);
  const [accelerometer,     setAccelerometer]     = useState({ x: 0, y: 9.8, z: 0, intensity: 'Still' });
  const [lastSyncedTime,    setLastSyncedTime]    = useState(null);
  const [patientCondition,  setPatientCondition]  = useState('normal');

  const intervalRef    = useRef(null);
  const heartRateRef   = useRef(null);
  const spo2Ref        = useRef(null);
  const currentUserRef = useRef(null);

  // ─── Token valid check ───────────────────────────────────────────────────
  const isTokenValid = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return !!token;
  };

  // ✅ Naya user check — signup ke baad 10 minute tak data save/show nahi hoga
  const isNewUser = async () => {
    try {
      const signupTime = await AsyncStorage.getItem('signupTime');
      if (!signupTime) return false;
      const minutesSinceSignup = (Date.now() - parseInt(signupTime)) / 1000 / 60;
      return minutesSinceSignup < 10;
    } catch (e) {
      return false;
    }
  };

  // ─── Full state reset ────────────────────────────────────────────────────
  const resetAllState = () => {
    setHeartRate(null);
    setLastHeartRateTime(null);
    setSpo2(null);
    setSteps(null);
    setRestingHeartRate(null);
    setBmi(null);
    setAccelerometer({ x: 0, y: 9.8, z: 0, intensity: 'Still' });
    setLastSyncedTime(null);
    setPatientCondition('normal');
    heartRateRef.current = null;
    spo2Ref.current      = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('🔄 useWearData: all state reset');
  };

  // ✅ userId dependency — jab bhi userId change ho (naya user login kare)
  useEffect(() => {
    if (!userId) {
      console.log('⚠️ useWearData: userId nahi mila, fetch skip');
      resetAllState();
      return;
    }

    // Agar pehle koi aur user tha — uska data saaf karo
    if (currentUserRef.current && currentUserRef.current !== userId) {
      console.log('👤 User badal gaya! Purana data reset kar raha hun...');
      resetAllState();
    }

    currentUserRef.current = userId;

    const timer = setTimeout(async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('⚠️ Token nahi mila — fetch skip');
        resetAllState();
        return;
      }

      // ✅ Naya user hai toh fetch skip karo
      const newUser = await isNewUser();
      if (newUser) {
        console.log('⏳ Naya user — 10 min baad data fetch hoga');
        // 10 minute baad dobara try karo
        setTimeout(async () => {
          const stillNewUser = await isNewUser();
          if (!stillNewUser) {
            console.log('✅ 10 min complete — ab data fetch shuru');
            initializeAndFetch();
          }
        }, 10 * 60 * 1000);
        return;
      }

      initializeAndFetch();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  // ─── Save to backend ─────────────────────────────────────────────────────
  const saveToBackend = async ({
    heartRate, bloodOxygen, temperature,
    footsteps, restingHeartRate, bmi,
    accelerometer, patientCondition,
  }) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('⚠️ Token nahi mila, backend save skip');
        return;
      }

      // ✅ Naya user check — 10 minute tak backend pe save nahi hoga
      const newUser = await isNewUser();
      if (newUser) {
        console.log('⏳ Naya user — 10 min baad backend save hoga, abhi skip');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/vitals/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          heartRate,
          bloodOxygen,
          temperature:      temperature      || 37.0,
          footsteps:        footsteps        || 0,
          restingHeartRate: restingHeartRate || null,
          bmi:              bmi              || null,
          accelerometer:    accelerometer    || { x: 0, y: 9.8, z: 0, intensity: 'Still' },
          patientCondition: patientCondition || 'normal',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`✅ Backend save | Condition: ${patientCondition} | HR: ${heartRate} | SpO2: ${bloodOxygen}`);
      } else {
        console.log('⚠️ Backend save failed:', data.message);
      }
    } catch (e) {
      console.log('❌ saveToBackend error:', e.message);
    }
  };

  // ─── Adaptive interval ───────────────────────────────────────────────────
  const setupAdaptiveInterval = (hr, sp) => {
    const condition = getPatientCondition(hr, sp);
    const interval  = getIntervalByCondition(condition);
    setPatientCondition(condition);
    if (intervalRef.current) clearInterval(intervalRef.current);
    console.log(`🔄 Condition: ${condition} | Next fetch: ${interval / 60000} min`);
    intervalRef.current = setInterval(async () => {
      const valid = await isTokenValid();
      if (!valid) {
        resetAllState();
        return;
      }
      const storedUserId = await AsyncStorage.getItem('userId');
      if (currentUserRef.current && currentUserRef.current !== storedUserId) {
        console.log('👤 Interval me user badal gaya! Rok raha hun...');
        resetAllState();
        return;
      }
      fetchData();
    }, interval);
  };

  // ─── Last synced time update ─────────────────────────────────────────────
  const updateLastSynced = (recordTime) => {
    if (!recordTime) return;
    const newTime = new Date(recordTime);
    if (isNaN(newTime.getTime())) return;
    setLastSyncedTime(prev => {
      if (!prev || newTime > new Date(prev)) return newTime;
      return prev;
    });
  };

  // ─── BMI load ────────────────────────────────────────────────────────────
  const loadBMIFromProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data?.height && data?.weight) {
        const heightStr   = data.height.toString();
        const parts       = heightStr.split('.');
        const feet        = parseInt(parts[0]) || 0;
        const inches      = parseInt(parts[1]) || 0;
        const totalInches = feet * 12 + inches;
        const heightM     = totalInches * 0.0254;
        const weightKg    = parseFloat(data.weight);
        if (heightM > 0 && weightKg > 0) {
          setBmi(parseFloat((weightKg / (heightM * heightM)).toFixed(1)));
        }
      } else if (data?.bmi) {
        setBmi(parseFloat(data.bmi));
      }
    } catch (e) {
      console.log('BMI load error:', e.message);
    }
  };

  // ─── Initialize Health Connect ───────────────────────────────────────────
  const initializeAndFetch = async () => {
    try {
      const valid = await isTokenValid();
      if (!valid) {
        console.log('⚠️ initializeAndFetch: no token, skip');
        resetAllState();
        return;
      }
      await loadBMIFromProfile();
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        console.log('❌ Health Connect not available');
        return;
      }
      const isInitialized = await initialize();
      if (!isInitialized) {
        console.log('❌ Health Connect initialize failed');
        return;
      }
      await fetchHeightWeight();
      await fetchData();
    } catch (error) {
      console.log('Init Error:', error.message);
    }
  };

  const askPermissions = async () => {
    try {
      const valid = await isTokenValid();
      if (!valid) return;
      await fetchData();
    } catch (e) {
      console.log('❌ error:', e.message);
    }
  };

  // ─── Accelerometer helpers ───────────────────────────────────────────────
  const getAccelFromRate = (stepsPerMinute) => {
    if (stepsPerMinute < 1)  return { x: 0.0, y: 9.8, z: 0.0, intensity: 'Still' };
    if (stepsPerMinute < 40) return { x: parseFloat((stepsPerMinute * 0.04).toFixed(2)),  y: parseFloat((9.8 - stepsPerMinute * 0.01).toFixed(2)),  z: parseFloat((stepsPerMinute * 0.025).toFixed(2)), intensity: 'Light'    };
    if (stepsPerMinute < 80) return { x: parseFloat((stepsPerMinute * 0.06).toFixed(2)),  y: parseFloat((9.8 - stepsPerMinute * 0.02).toFixed(2)),  z: parseFloat((stepsPerMinute * 0.04).toFixed(2)),  intensity: 'Moderate' };
    return                          { x: parseFloat((stepsPerMinute * 0.09).toFixed(2)),  y: parseFloat((9.8 - stepsPerMinute * 0.035).toFixed(2)), z: parseFloat((stepsPerMinute * 0.065).toFixed(2)), intensity: 'Active'   };
  };

  const calculateAccelerometerFromSteps = (stepsRecords) => {
    try {
      if (!stepsRecords || stepsRecords.length === 0)
        return { x: 0.0, y: 9.8, z: 0.0, intensity: 'Still' };
      const now        = new Date();
      const tenMinAgo  = new Date(now.getTime() - 10 * 60 * 1000);
      const recentRecs = stepsRecords.filter(r => new Date(r.endTime || r.startTime) >= tenMinAgo);
      if (recentRecs.length > 0) {
        const recentSteps = recentRecs.reduce((s, r) => s + (r.count || 0), 0);
        return getAccelFromRate(recentSteps / 10);
      }
      const totalSteps     = stepsRecords.reduce((s, r) => s + (r.count || 0), 0);
      const firstTime      = new Date(stepsRecords[0].startTime || stepsRecords[0].endTime);
      const minutesElapsed = Math.max(1, (now - firstTime) / 1000 / 60);
      return getAccelFromRate(totalSteps / minutesElapsed);
    } catch (e) {
      return { x: 0.0, y: 9.8, z: 0.0, intensity: 'Still' };
    }
  };

  // ─── Height/Weight fetch ─────────────────────────────────────────────────
  const fetchHeightWeight = async () => {
    try {
      const valid = await isTokenValid();
      if (!valid) return;
      const now     = new Date();
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = now.toISOString();
      const heightData = await readRecords('Height', { timeRangeFilter: { operator: 'between', startTime: last30d, endTime } });
      const weightData = await readRecords('Weight', { timeRangeFilter: { operator: 'between', startTime: last30d, endTime } });
      if (heightData.records.length > 0 && weightData.records.length > 0) {
        const h  = heightData.records[heightData.records.length - 1];
        const w  = weightData.records[weightData.records.length - 1];
        const hm = h.height?.inMeters ?? h.value ?? null;
        const wk = w.weight?.inKilograms ?? w.value ?? null;
        if (hm && wk) setBmi(parseFloat((wk / (hm * hm)).toFixed(1)));
        updateLastSynced(new Date(w.endTime ?? w.startTime ?? w.time));
      }
    } catch (e) {
      console.log('Height/Weight HC error:', e.message);
    }
  };

  // ─── Main fetch ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const valid = await isTokenValid();
      if (!valid) {
        console.log('⚠️ fetchData: no token, resetting state');
        resetAllState();
        return;
      }

      // ✅ Naya user hai toh Health Connect data screen pe mat dikhao
      const newUser = await isNewUser();
      if (newUser) {
        console.log('⏳ Naya user — Health Connect data skip, vitals -- rahenge');
        return;
      }

      // User change check
      const storedUserId = await AsyncStorage.getItem('userId');
      if (currentUserRef.current && currentUserRef.current !== storedUserId) {
        console.log('👤 fetchData: user badal gaya, reset...');
        resetAllState();
        return;
      }

      const now     = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = now.toISOString();

      let latestHR    = heartRateRef.current;
      let latestSpo2  = spo2Ref.current;
      let latestSteps = 0;
      let latestAccel = { x: 0, y: 9.8, z: 0, intensity: 'Still' };

      // Heart Rate
      try {
        const hrData = await readRecords('HeartRate', { timeRangeFilter: { operator: 'between', startTime: last24h, endTime } });
        if (hrData.records.length > 0) {
          const latest = hrData.records[hrData.records.length - 1];
          const bpm    = latest.samples?.[0]?.beatsPerMinute ?? latest.beatsPerMinute ?? null;
          if (bpm) {
            setHeartRate(bpm);
            setLastHeartRateTime(new Date(latest.endTime ?? latest.startTime ?? latest.time));
            updateLastSynced(new Date(latest.endTime ?? latest.startTime ?? latest.time));
            latestHR = bpm;
            heartRateRef.current = bpm;
            console.log('✅ HR:', bpm);
          }
          let minBPM = Infinity;
          hrData.records.forEach(r => {
            const b = r.samples?.[0]?.beatsPerMinute ?? r.beatsPerMinute ?? null;
            if (b && b > 40 && b < minBPM) minBPM = b;
          });
          if (minBPM !== Infinity) setRestingHeartRate(minBPM);
        }
      } catch (e) { console.log('HR error:', e.message); }

      // SpO2
      try {
        const spo2Data = await readRecords('OxygenSaturation', { timeRangeFilter: { operator: 'between', startTime: last24h, endTime } });
        if (spo2Data.records.length > 0) {
          const latest = spo2Data.records[spo2Data.records.length - 1];
          const value  = latest.percentage ?? latest.value ?? null;
          if (value !== null) {
            const spo2Val = value <= 1 ? Math.round(value * 100) : Math.round(value);
            setSpo2(spo2Val);
            updateLastSynced(new Date(latest.endTime ?? latest.startTime ?? latest.time));
            latestSpo2 = spo2Val;
            spo2Ref.current = spo2Val;
          }
        }
      } catch (e) { console.log('SPO2 error:', e.message); }

      // Steps
      try {
        const midnightToday = new Date();
        midnightToday.setHours(0, 0, 0, 0);
        const stepsData = await readRecords('Steps', {
          timeRangeFilter: { operator: 'between', startTime: midnightToday.toISOString(), endTime: now.toISOString() },
        });
        if (stepsData.records.length > 0) {
          const totalSteps = stepsData.records.reduce((s, r) => s + r.count, 0);
          setSteps(totalSteps);
          latestSteps = totalSteps;
          const accel = calculateAccelerometerFromSteps(stepsData.records);
          setAccelerometer(accel);
          latestAccel = accel;
          updateLastSynced(new Date(stepsData.records[stepsData.records.length - 1].endTime ?? stepsData.records[stepsData.records.length - 1].startTime));
        }
      } catch (e) { console.log('Steps error:', e.message); }

      if (latestHR || latestSpo2) {
        await saveToBackend({
          heartRate:        latestHR,
          bloodOxygen:      latestSpo2,
          temperature:      37.0,
          footsteps:        latestSteps,
          restingHeartRate: restingHeartRate,
          bmi:              bmi,
          accelerometer:    latestAccel,
          patientCondition: getPatientCondition(latestHR, latestSpo2),
        });
      }

      setupAdaptiveInterval(latestHR, latestSpo2);

    } catch (error) {
      console.log('Fetch Error:', error.message);
    }
  };

  return {
    heartRate,
    lastHeartRateTime,
    lastSyncedTime,
    spo2,
    steps,
    restingHeartRate,
    bmi,
    accelerometer,
    patientCondition,
    askPermissions,
  };
};
