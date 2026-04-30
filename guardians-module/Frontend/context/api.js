import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.7:5001'; 

export const getToken = async () => {
  return await AsyncStorage.getItem('guardianToken');
};

export const authFetch = async (endpoint, options = {}) => {
  try {
    const token = await getToken();
    
    if (!token) {
      console.warn('⛔ authFetch: No token for', endpoint);
      return { success: false, message: 'No token' };
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ authFetch ${endpoint} → HTTP ${response.status}`);
      return { success: false, message: `HTTP ${response.status}` };
    }

    return await response.json();

  } catch (err) {
    console.error(`❌ authFetch failed [${endpoint}]:`, err.message);
    return { success: false, message: err.message };  // ← throw ki jagah return karo
  }
};

export default API_BASE_URL;