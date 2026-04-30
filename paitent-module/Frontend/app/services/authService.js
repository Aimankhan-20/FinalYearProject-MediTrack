import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export const authService = {

  // ─── Sign Up ─────────────────────────────────────────────────────────────
  signup: async (userData) => {
    try {
      console.log('🔄 Starting signup...');
      const response = await api.post('/api/auth/signup', userData);
      console.log('✅ Signup successful:', response.data);

      if (response.data.token) {
        await authService._clearAllUserData();

        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user || response.data));

        const userId = response.data.user?._id || response.data._id || response.data.user?.id || response.data.id;
        if (userId) {
          await AsyncStorage.setItem('userId', userId);
          console.log('💾 userId saved:', userId);
        }

        await AsyncStorage.setItem('isNewSignup', 'true');
        console.log('✅ isNewSignup flag set');
      }

      return response.data;
    } catch (error) {
      console.error('❌ Signup failed:', error);
      if (error.response)     throw error.response.data;
      else if (error.request) throw { message: 'Cannot connect to server. Please check your internet connection.' };
      else                    throw { message: error.message || 'Signup failed' };
    }
  },

  // ─── Login ───────────────────────────────────────────────────────────────
  login: async (credentials) => {
    try {
      console.log('🔄 Starting login...');
      const response = await api.post('/api/auth/login', credentials);
      console.log('✅ Login successful');

      if (response.data.token) {
        await authService._clearAllUserData();

        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user || response.data));

        const userId = response.data.user?._id || response.data._id || response.data.user?.id || response.data.id;
        if (userId) {
          await AsyncStorage.setItem('userId', userId);
          console.log('💾 userId saved:', userId);
        }

        const userName = response.data.user?.name || response.data.name;
        if (userName) {
          await AsyncStorage.setItem('userName', userName);
          console.log('💾 userName saved:', userName);
        }
      }

      return response.data;
    } catch (error) {
      console.error('❌ Login failed:', error);
      if (error.response)     throw error.response.data;
      else if (error.request) throw { message: 'Cannot connect to server. Please check your internet connection.' };
      else                    throw { message: error.message || 'Login failed' };
    }
  },

  // ─── Logout ──────────────────────────────────────────────────────────────
  logout: async () => {
    try {
      await authService._clearAllUserData();
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  },

  // ─── Clear ALL user data ─────────────────────────────────────────────────
  // ✅ Jab bhi naya key add karo app mein — yahan bhi add karo
  _clearAllUserData: async () => {
    const keysToRemove = [
      // Auth
      'userToken',
      'userData',
      'userId',
      'userName',
      'email',
      'username',
      // Watch
      'watchPaired',
      'watchName',
      'isNewSignup',
      // Vitals cache
      'lastVitalsCache',
      'lastSyncTime',
      // ✅ Background sync — naye user pe purana sync na chale
      'bgSyncUserId',
      'nextSyncInterval',
      'lastCondition',
    ];
    await AsyncStorage.multiRemove(keysToRemove);
    console.log('🧹 All user data cleared from AsyncStorage');
  },

  // ─── Get current user ────────────────────────────────────────────────────
  getCurrentUser: async () => {
    try {
      const userDataStr = await AsyncStorage.getItem('userData');
      return userDataStr ? JSON.parse(userDataStr) : null;
    } catch (error) {
      console.error('❌ Get user error:', error);
      return null;
    }
  },

  // ─── Check if authenticated ───────────────────────────────────────────────
  isAuthenticated: async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return !!token;
    } catch (error) {
      return false;
    }
  },
};

export default authService;