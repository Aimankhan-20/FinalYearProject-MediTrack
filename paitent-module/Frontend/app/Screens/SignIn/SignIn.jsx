import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, Animated, Dimensions, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../constants/constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const { width, height } = Dimensions.get('window');

const API_URL = `${API_BASE_URL}/api/auth`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ScrollView ref for auto-scroll
  const scrollViewRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(height)).current;
  const titleSlide = useRef(new Animated.Value(-50)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const input1Slide = useRef(new Animated.Value(100)).current;
  const input2Slide = useRef(new Animated.Value(100)).current;
  const buttonSlide = useRef(new Animated.Value(100)).current;
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const colorPulse = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(logoRotate, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(cardSlide, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.stagger(100, [
        Animated.parallel([
          Animated.spring(titleSlide, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(input1Slide, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(input2Slide, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(buttonSlide, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, 600);

    Animated.loop(
      Animated.sequence([
        Animated.timing(float1, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(float1, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float2, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(float2, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float3, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(float3, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(colorPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(colorPulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ✅ Jab koi field focus ho, scroll karke us field ko visible karo
  const handleFieldFocus = (yOffset) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 300);
  };

  const registerForPushNotifications = async () => {
    try {
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications only work on real device');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Notification permission denied');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log('✅ Expo Push Token:', tokenData.data);
      return tokenData.data;

    } catch (error) {
      console.log('⚠️ Push token skipped:', error.message);
      return null;
    }
  };

  const savePushTokenToBackend = async (userToken, expoPushToken) => {
    try {
      const response = await fetch(`${API_URL}/save-push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ expoPushToken }),
      });
      const data = await response.json();
      if (data.success) {
        console.log('✅ Push token saved to backend');
      }
    } catch (error) {
      console.log('⚠️ Failed to save push token:', error.message);
    }
  };

  const handleLogin = async () => {
    Animated.sequence([
      Animated.spring(buttonScale, {
        toValue: 0.9,
        tension: 200,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 200,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password,
        }),
      });

      const data = await response.json();

     if (response.ok) {
  // ✅ Pehle wala sab data saaf karo
  await AsyncStorage.multiRemove([
    'userToken',
    'userEmail',
    'username',
    'email',
    'watchPaired',
    'watchName',
    'isNewSignup',
  ]);

  // ✅ Naye user ka data save karo
  await AsyncStorage.setItem('userToken', data.token);
  await AsyncStorage.setItem('userEmail', email.toLowerCase().trim());
  await AsyncStorage.setItem('username', data.user?.name || email.split('@')[0]);

        const expoPushToken = await registerForPushNotifications();
        
        if (expoPushToken) {
          await savePushTokenToBackend(data.token, expoPushToken);
        }

        Animated.parallel([
          Animated.timing(cardSlide, {
            toValue: height,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          router.push({
            pathname: '/Screens/HomeScreen/HomeScreen',
            params: {
              email: email.toLowerCase().trim(),
              username: email.split('@')[0]
            }
          });
        });
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Unable to connect to server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const float1Y = float1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const float2Y = float2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const float3Y = float3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const logoOpacity = colorPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.8, 1],
  });

  return (
    // ✅ KeyboardAvoidingView — keyboard aane par card upar uthta hai
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.backgroundOverlay} />

        <Animated.View style={[styles.particle1, { transform: [{ translateY: float1Y }] }]} />
        <Animated.View style={[styles.particle2, { transform: [{ translateY: float2Y }] }]} />
        <Animated.View style={[styles.particle3, { transform: [{ translateY: float3Y }] }]} />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: logoScale }, { rotate: logoRotation }],
                opacity: logoOpacity,
              }
            ]}
          >
            <Ionicons name="shield-checkmark" size={50} color="#fff" />
          </Animated.View>
        </View>

        {/* ✅ Card ke andar ScrollView — fields focus hone par scroll hota hai */}
        <Animated.View style={[styles.card, { transform: [{ translateY: cardSlide }] }]}>
          <ScrollView
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Title */}
            <Animated.View style={{ transform: [{ translateY: titleSlide }], opacity: titleOpacity }}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>Sign in to continue your journey</Text>
            </Animated.View>

            {/* Email Field */}
            <Animated.View
              style={[
                styles.inputContainer,
                {
                  transform: [{ translateX: input1Slide }],
                  opacity: input1Slide.interpolate({ inputRange: [0, 100], outputRange: [1, 0] })
                }
              ]}
            >
              <View style={styles.iconWrapper}>
                <Ionicons name="mail-outline" size={20} color="#667eea" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                // ✅ Focus hone par thoda scroll karo taake field dikhti rahe
                onFocus={() => handleFieldFocus(0)}
                returnKeyType="next"
              />
            </Animated.View>

            {/* Password Field */}
            <Animated.View
              style={[
                styles.inputContainer,
                {
                  transform: [{ translateX: input2Slide }],
                  opacity: input2Slide.interpolate({ inputRange: [0, 100], outputRange: [1, 0] })
                }
              ]}
            >
              <View style={styles.iconWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                // ✅ Password field focus hone par aur scroll karo
                onFocus={() => handleFieldFocus(80)}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#667eea"
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => router.push('/Screens/ForgetPassword/ForgetPassword')}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <Animated.View style={[{ transform: [{ translateY: buttonSlide }, { scale: buttonScale }] }]}>
              <TouchableOpacity
                style={[styles.signInButton, loading && styles.signInButtonDisabled]}
                onPress={handleLogin}
                activeOpacity={0.9}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push('/Screens/SignUp/SignUp')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom padding taake keyboard ke peeche na chhuppe */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  backgroundOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#764ba2',
    opacity: 0.3,
  },
  particle1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    top: 100,
    left: 50,
  },
  particle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: 50,
    right: 30,
  },
  particle3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    top: 200,
    right: 100,
  },
  header: {
    height: 250,
    paddingTop: 50,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  // ✅ ScrollView ka content padding
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    paddingHorizontal: 15,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  iconWrapper: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: '#333',
  },
  eyeIcon: {
    padding: 8,
  },
  forgotText: {
    color: '#667eea',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 18,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  signUpText: {
    color: '#666',
    fontSize: 15,
  },
  signUpLink: {
    color: '#667eea',
    fontSize: 15,
    fontWeight: 'bold',
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
