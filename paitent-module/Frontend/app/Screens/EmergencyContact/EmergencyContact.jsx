import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, FlatList, Alert, ActivityIndicator,
} from "react-native";
import * as SMS from "expo-sms";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import { API_BASE_URL } from '../../constants/constants';

const API_BASE = `${API_BASE_URL}/api/emergency-contacts`;

export default function EmergencyContact() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState(""); // ✅ NEW
  const [relationship, setRelationship] = useState("");

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => {
    const loadUserAndContacts = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c =>
              '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
          );
          const decoded = JSON.parse(jsonPayload);
          setUserId(decoded.userId);
          fetchContacts(decoded.userId);
        }
      } catch (err) {
        console.log('❌ Error loading user:', err);
      }
    };
    loadUserAndContacts();
  }, []);

  useEffect(() => {
    if (contacts.length >= 0) saveToAsyncStorage(contacts);
  }, [contacts]);

  const saveToAsyncStorage = async (contactsList) => {
    try {
      const formatted = contactsList.map(c => ({
        name: c.name, phone: c.phone, relationship: c.relationship
      }));
      await AsyncStorage.setItem('emergencyContacts', JSON.stringify(formatted));
    } catch (error) {
      console.log('❌ Error saving to AsyncStorage:', error);
    }
  };

  const fetchContacts = async (uid) => {
    const id = uid || userId;
    if (!id) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/user/${id}`);
      if (response.data.success) {
        setContacts(response.data.contacts);
        await saveToAsyncStorage(response.data.contacts);
      }
    } catch (err) {
      console.log("❌ Error fetching contacts:", err);
      if (err.request) Alert.alert("Connection Error", "Cannot connect to server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sendEmergencyAlertToAll = async () => {
    if (!userId) return;
    try {
      setSendingAlert(true);
      const response = await axios.post(`${API_BASE}/send-alert`, {
        userId,
        alertMessage: "🚨 HEALTH ALERT: Abnormal vitals detected! Please check immediately.",
        vitalsData: { timestamp: new Date().toISOString(), source: "Manual Alert" }
      });

      if (response.data.success) {
        const { contacts: alertContacts, alertMessage } = response.data;
        if (alertContacts.length === 0) {
          Alert.alert("No Contacts", "Please add emergency contacts first.");
          return;
        }

        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) { Alert.alert("Error", "SMS not supported on this device"); return; }

        const phoneNumbers = alertContacts.map(c => c.phone);
        await SMS.sendSMSAsync(phoneNumbers, alertMessage);

        Alert.alert(
          "✅ Alert Sent!",
          `SMS sent to ${alertContacts.length} contact(s):\n\n${alertContacts.map(c => `${c.name} (${c.relationship})`).join('\n')}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Failed to send alert.");
    } finally {
      setSendingAlert(false);
    }
  };

  const handleAddOrEditContact = async () => {
    if (!fullName || !phoneNumber || !relationship) {
      Alert.alert("Missing Info", "Please fill all required fields.");
      return;
    }
    if (!userId) {
      Alert.alert("Error", "User not found. Please login again.");
      return;
    }

    try {
      setLoading(true);

      if (editingContact) {
        const response = await axios.put(`${API_BASE}/update/${editingContact._id}`, {
          name: fullName,
          phone: phoneNumber,
          email: emailAddress || null, // ✅ NEW
          relationship,
        });
        if (response.data.success) {
          Alert.alert("Success", "Contact updated successfully!");
          await fetchContacts(userId);
        }
      } else {
        const response = await axios.post(`${API_BASE}/add`, {
          userId,
          name: fullName,
          phone: phoneNumber,
          email: emailAddress || null, // ✅ NEW
          relationship,
          isPrimary: contacts.length === 0,
        });
        if (response.data.success) {
          Alert.alert("Success", "Contact added successfully!");
          await fetchContacts(userId);
        }
      }

      closeModal();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to save contact");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = (id) => {
    Alert.alert("Delete Contact", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const response = await axios.delete(`${API_BASE}/delete/${id}`);
            if (response.data.success) {
              Alert.alert("Success", "Contact deleted!");
              await fetchContacts(userId);
            }
            setMenuVisible(false);
          } catch (err) {
            Alert.alert("Error", "Failed to delete contact");
          }
        },
      },
    ]);
  };

  const handleSendSMS = async (phone) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) { Alert.alert("SMS not supported on this device"); return; }
    await SMS.sendSMSAsync([phone], "🚨 Health Alert: Abnormal vitals detected! Please check immediately.");
  };

  const openModalForEdit = (contact) => {
    setEditingContact(contact);
    setFullName(contact.name);
    setPhoneNumber(contact.phone);
    setEmailAddress(contact.email || ""); // ✅ NEW
    setRelationship(contact.relationship);
    setModalVisible(true);
    setMenuVisible(false);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingContact(null);
    setFullName("");
    setPhoneNumber("");
    setEmailAddress(""); // ✅ NEW
    setRelationship("");
  };

  const renderContact = ({ item }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactLeft}>
        <Ionicons name="person-circle" size={45} color="#007BFF" />
        <View>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactDetails}>{item.relationship} • {item.phone}</Text>
          {/* ✅ NEW: Email dikhao agar hai */}
          {item.email ? (
            <Text style={styles.contactEmail}>📧 {item.email}</Text>
          ) : (
            <Text style={styles.contactEmailMissing}>No email added</Text>
          )}
        </View>
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity onPress={() => handleSendSMS(item.phone)}>
          <Ionicons name="chatbubble-ellipses-outline" size={23} color="#007BFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setSelectedContact(item); setMenuVisible(true); }}>
          <Ionicons name="ellipsis-vertical" size={23} color="#475569" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={28} color="#828c97ff" />
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Contacts</Text>
      </View>

      <Text style={styles.infoBox}>
        🚨 Contacts below will be notified via SMS if abnormal vitals are detected.
      </Text>

      <TouchableOpacity
        style={styles.emergencyAlertButton}
        onPress={sendEmergencyAlertToAll}
        disabled={sendingAlert || contacts.length === 0}
      >
        {sendingAlert ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="warning" size={24} color="#fff" />
            <Text style={styles.emergencyAlertText}>Send Emergency Alert to All</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Ionicons name="add-circle-outline" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Add Contact</Text>
      </TouchableOpacity>

      {loading && contacts.length === 0 ? (
        <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id}
          renderItem={renderContact}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchContacts(userId); }}
          ListEmptyComponent={<Text style={styles.emptyText}>No contacts added yet.</Text>}
          contentContainerStyle={{ marginTop: 20, width: "100%" }}
        />
      )}

      {/* ── Add/Edit Modal ── */}
      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {editingContact ? "Edit Contact" : "Add Emergency Contact"}
            </Text>

            <TextInput placeholder="Full Name *" style={styles.input}
              value={fullName} onChangeText={setFullName} />

            <TextInput placeholder="Phone Number *" keyboardType="phone-pad" style={styles.input}
              value={phoneNumber} onChangeText={setPhoneNumber} />

            {/* ✅ NEW: Email field */}
            <TextInput
              placeholder="Email Address (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              value={emailAddress}
              onChangeText={setEmailAddress}
            />

            <TextInput placeholder="Relationship *" style={styles.input}
              value={relationship} onChangeText={setRelationship} />

            {/* ✅ Helper text */}
            <Text style={styles.helperText}>
              Add email restriction so that the guardian can register only with that specific email.
            </Text>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addContactButton}
                onPress={handleAddOrEditContact} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.addContactButtonText}>
                    {editingContact ? "Save Changes" : "Add"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Menu Modal ── */}
      <Modal transparent animationType="fade" visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPressOut={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuOption} onPress={() => openModalForEdit(selectedContact)}>
              <Ionicons name="create-outline" size={20} color="#1E293B" />
              <Text style={styles.menuText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} onPress={() => handleDeleteContact(selectedContact._id)}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuText, { color: "#EF4444" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 5 },
  backButton: { marginRight: 10, padding: 5 },
  title: { fontSize: 24, fontWeight: "700", color: "#1E293B" },
  infoBox: { backgroundColor: "#FFE5E5", color: "#B00020", padding: 10, borderRadius: 8, textAlign: "center", marginTop: 10 },
  emergencyAlertButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#DC2626", paddingVertical: 14, justifyContent: "center", borderRadius: 10, marginTop: 15, elevation: 3, gap: 8 },
  emergencyAlertText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  addButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#007BFF", paddingVertical: 12, justifyContent: "center", borderRadius: 10, marginTop: 15, elevation: 2 },
  addButtonText: { color: "#fff", fontSize: 17, fontWeight: "600", marginLeft: 8 },
  emptyText: { marginTop: 50, textAlign: "center", fontSize: 16, color: "#6B7280" },
  contactCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 12, marginHorizontal: 5, elevation: 1 },
  contactLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  contactName: { fontSize: 17, fontWeight: "600", color: "#1E293B" },
  contactDetails: { fontSize: 14, color: "#64748B" },
  contactEmail: { fontSize: 12, color: "#007BFF", marginTop: 2 },           // ✅ NEW
  contactEmailMissing: { fontSize: 12, color: "#D1D5DB", marginTop: 2 },    // ✅ NEW
  contactActions: { flexDirection: "row", alignItems: "center", gap: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContainer: { width: "85%", backgroundColor: "#fff", borderRadius: 14, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1E293B", textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 16 },
  helperText: { fontSize: 12, color: "#6B7280", marginBottom: 16, lineHeight: 18 }, // ✅ NEW
  modalButtonContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  cancelButton: { backgroundColor: "#E5E7EB", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancelButtonText: { color: "#374151", fontWeight: "600" },
  addContactButton: { backgroundColor: "#007BFF", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  addContactButtonText: { color: "#fff", fontWeight: "600" },
  menuOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  menuContainer: { backgroundColor: "#fff", width: 180, borderRadius: 10, paddingVertical: 8, elevation: 5 },
  menuOption: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 15, gap: 10 },
  menuText: { fontSize: 16, color: "#1E293B" },
});
