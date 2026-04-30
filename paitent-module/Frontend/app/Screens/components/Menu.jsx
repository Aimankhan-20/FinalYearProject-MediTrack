// Path: app/Screens/components/Menu.jsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  X,
  Phone,
  Watch,
  Settings,
  LogOut,
  Info,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function Menu({ visible, onClose }) {
  const router = useRouter();
  const slideAnim = React.useRef(new Animated.Value(-width * 0.75)).current;
  
  const [userName, setUserName] = React.useState('User');
  const [userEmail, setUserEmail] = React.useState('xyz@gmail.com');

  React.useEffect(() => {
    const getUserData = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        const name = await AsyncStorage.getItem('userName');
        
        if (email) {
          setUserEmail(email);
          if (name) {
            setUserName(name);
          } else {
            const extractedName = email.split('@')[0];
            setUserName(extractedName.charAt(0).toUpperCase() + extractedName.slice(1));
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    if (visible) {
      getUserData();
    }
  }, [visible]);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width * 0.75,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleNavigation = (route) => {
    onClose();
    setTimeout(() => {
      router.push(route);
    }, 300);
  };

  // ✅ FIXED: Logout — purana user ka sab data clear karo
const handleLogout = async () => {
  try {
    await AsyncStorage.multiRemove([
      'userToken',
      'userData',
      'username',
      'userName',
      'userEmail',
      'email',
      'userId',
      'watchPaired',
      'watchName',
    ]);
    console.log('✅ AsyncStorage cleared on logout');
  } catch (error) {
    console.error('Logout clear error:', error);
  } finally {
    onClose();
    // ✅ WelcomeScreen pe bhejo — replace taake back na ja sake
    router.replace('/Screens/WelcomeScreen/WelcomeScreen');
  }
};

  const menuItems = [
    {
      icon: Phone,
      label: "Emergency Contact",
      route: "/Screens/EmergencyContact/EmergencyContact",
    },
    {
      icon: Info,
      label: "About",
      route: "/Screens/About/About",
    },
    {
      icon: Settings,
      label: "Setting",
      route: "/Screens/SettingScreen/SettingScreen",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Menu Drawer */}
        <Animated.View
          style={[
            styles.menuContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => {
                onClose();
                router.replace('/Screens/HomeScreen/HomeScreen');
              }}
            >
              <X size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <User size={32} color="#3B82F6" />
            </View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>

          {/* Menu Items */}
          <View style={styles.menuItems}>
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => handleNavigation(item.route)}
                  activeOpacity={0.7}
                >
                  <Icon size={20} color="#374151" />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ✅ FIXED: Logout Button — ab handleLogout call hoga */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.75,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  menuItems: {
    flex: 1,
    paddingTop: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemText: {
    fontSize: 16,
    color: "#374151",
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 16,
  },
});
