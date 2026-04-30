import BackgroundFetch from 'react-native-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readRecords, initialize, getSdkStatus, SdkAvailabilityStatus } from 'react-native-health-connect';
import { API_BASE_URL } from '../app/constants/constants';
import { getPatientCondition, getIntervalByCondition } from './useWearData';

const fetchAndSaveToBackend = async () => {
  try {
    // ✅ FIX 1: Pehle token aur userId dono check karo
    const token  = await AsyncStorage.getItem('userToken');
    const userId = await AsyncStorage.getItem('userId');

    console.log('🔑 Token:', token ? 'EXISTS' : 'NULL');
    console.log('👤 UserId:', userId ? userId : 'NULL');

    // ✅ FIX 2: Dono nahi hain toh bilkul kuch mat karo
    // Naya user abhi register ho raha hai — background sync rok do
    if (!token || !userId) {
      console.log('⚠️ Background sync skip — token ya userId nahi mila');
      return;
    }

    // ✅ FIX 3: Saved userId se match karo — purana user ka sync naya user pe na aye
    const savedSyncUserId = await AsyncStorage.getItem('bgSyncUserId');
    if (savedSyncUserId && savedSyncUserId !== userId) {
      console.log('👤 User badal gaya — background sync reset kar raha hun');
      await AsyncStorage.setItem('bgSyncUserId', userId);
      await AsyncStorage.removeItem('nextSyncInterval');
      await AsyncStorage.removeItem('lastCondition');
      return; // Is cycle mein kuch save mat karo
    }

    // ✅ FIX 4: Current userId save karo future checks ke liye
    await AsyncStorage.setItem('bgSyncUserId', userId);

    // ─── Health Connect initialize ───────────────────────────────────────
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return;
    const isInitialized = await initialize();
    if (!isInitialized) return;

    const now     = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const endTime = now.toISOString();

    // ─── Heart Rate ──────────────────────────────────────────────────────
    let heartRate = 0;
    const hrData = await readRecords('HeartRate', {
      timeRangeFilter: { operator: 'between', startTime: last24h, endTime },
    });
    if (hrData.records.length > 0) {
      const latest = hrData.records[hrData.records.length - 1];
      heartRate = latest.samples?.[0]?.beatsPerMinute ?? latest.beatsPerMinute ?? 0;
    }

    // ─── SPO2 ────────────────────────────────────────────────────────────
    let spo2 = 0;
    const spo2Data = await readRecords('OxygenSaturation', {
      timeRangeFilter: { operator: 'between', startTime: last24h, endTime },
    });
    if (spo2Data.records.length > 0) {
      const latest = spo2Data.records[spo2Data.records.length - 1];
      const value  = latest.percentage ?? latest.value ?? null;
      if (value !== null) spo2 = value <= 1 ? Math.round(value * 100) : Math.round(value);
    }

    // ─── Steps ───────────────────────────────────────────────────────────
    let steps = 0;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const stepsData = await readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: midnight.toISOString(), endTime },
    });
    if (stepsData.records.length > 0) {
      stepsData.records.forEach((r) => (steps += r.count));
    }

    // ✅ FIX 5: Agar heartRate 0 hai — Health Connect mein data nahi
    // Naye user ka koi data nahi hoga — save karna pointless hai
    if (!heartRate && !spo2) {
      console.log('⚠️ Background sync skip — Health Connect mein koi data nahi');
      return;
    }

    // ─── Condition check ─────────────────────────────────────────────────
    const condition    = getPatientCondition(heartRate, spo2);
    const nextInterval = getIntervalByCondition(condition);
    console.log(`🏥 Condition: ${condition} | Next sync: ${nextInterval / 60000} min`);

    // ─── Backend save ────────────────────────────────────────────────────
    const response = await fetch(`${API_BASE_URL}/api/vitals/record`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({
        heartRate,
        bloodOxygen:      spo2,
        temperature:      37.0,
        footsteps:        steps,
        restingHeartRate: heartRate,
        condition,
        nextSyncInterval: nextInterval,
      }),
    });

    const result = await response.json();
    console.log('🔴 Backend response:', JSON.stringify(result));
    console.log('✅ Background sync done:', { heartRate, spo2, steps, condition });

    // ─── Next interval save ───────────────────────────────────────────────
    await AsyncStorage.setItem('nextSyncInterval', String(nextInterval));
    await AsyncStorage.setItem('lastCondition', condition);

  } catch (e) {
    console.log('Background sync error:', e.message);
  }
};

export const configureBackgroundFetch = async () => {
  const savedInterval = await AsyncStorage.getItem('nextSyncInterval');
  const intervalMs    = savedInterval ? parseInt(savedInterval) : 60 * 60 * 1000;
  const intervalMin   = Math.max(15, Math.floor(intervalMs / 60000));

  console.log(`⚙️ Background fetch interval: ${intervalMin} min`);

  BackgroundFetch.configure(
    {
      minimumFetchInterval: intervalMin,
      stopOnTerminate:      false,
      startOnBoot:          true,
      enableHeadless:       true,
      requiredNetworkType:  BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async (taskId) => {
      console.log('📡 Background fetch triggered:', taskId);
      await fetchAndSaveToBackend();

      const newInterval = await AsyncStorage.getItem('nextSyncInterval');
      if (newInterval) {
        BackgroundFetch.scheduleTask({
          taskId:   'adaptive-vitals-sync',
          delay:    parseInt(newInterval),
          periodic: false,
        });
      }

      BackgroundFetch.finish(taskId);
    },
    (taskId) => {
      console.log('❌ Background fetch timeout:', taskId);
      BackgroundFetch.finish(taskId);
    }
  );
};

// ✅ Logout pe background sync user data clear karo
export const clearBackgroundSyncData = async () => {
  await AsyncStorage.multiRemove([
    'bgSyncUserId',
    'nextSyncInterval',
    'lastCondition',
  ]);
  console.log('🧹 Background sync data cleared');
};

export const testBackgroundSync = fetchAndSaveToBackend;