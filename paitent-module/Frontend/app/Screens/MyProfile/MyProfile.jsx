import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  User,
  Activity,
  Calendar,
  Phone,
  MapPin,
  AlertTriangle,
  Heart,
  Droplets,
  Thermometer,
  X,
  Camera,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { getProfile, updateVitalSigns, uploadProfilePhoto } from "../../services/api";
import Footer from "../components/Footer";

export default function MyProfile({ navigation = {}, route = {} }) {
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profileImage, setProfileImage] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [vitalsModalVisible, setVitalsModalVisible] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    bloodSugar: "",
    temperature: "",
  });

  // Har baar screen focus hone par fresh data fetch karo
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const userData = await getProfile();
      setProfileData(userData);
      if (userData?.profilePhoto) {
        setProfileImage(userData.profilePhoto);
      } else {
        setProfileImage(null);
      }
    } catch (error) {
      console.error("❌ Error fetching profile:", error);
      if (error.message.includes("No authentication token")) {
        Alert.alert("Session Expired", "Please login again", [
          { text: "OK", onPress: () => router.replace("/Screens/SignIn/SignIn") },
        ]);
      } else {
        Alert.alert("Error", "Failed to load profile. Please try again.", [
          { text: "Retry", onPress: fetchProfile },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handlePickProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo gallery to change your profile picture.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const selectedUri = result.assets[0].uri;
        setProfileImage(selectedUri);
        await uploadPhoto(selectedUri);
      }
    } catch (error) {
      console.error("❌ Image picker error:", error);
      Alert.alert("Error", "Could not open gallery. Please try again.");
    }
  };

  const uploadPhoto = async (uri) => {
    try {
      setUploadingPhoto(true);
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename ?? "");
      const type = match ? `image/${match[1]}` : "image/jpeg";

      const formData = new FormData();
      formData.append("profilePhoto", { uri, name: filename, type });

      const response = await uploadProfilePhoto(formData);

      if (response?.profilePhotoUrl) {
        setProfileImage(response.profilePhotoUrl);
        setProfileData((prev) => ({
          ...prev,
          profilePhoto: response.profilePhotoUrl,
        }));
      }

      Alert.alert("✅ Photo Updated", "Your profile photo has been saved successfully.");
    } catch (error) {
      console.error("❌ Photo upload error:", error);
      Alert.alert("Upload Failed", "Could not save your photo. Please try again.");
      setProfileImage(profileData?.profilePhoto || null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openVitalsModal = () => {
    if (profileData?.vitals) {
      const { bpSystolic, bpDiastolic, bloodSugar, temperature } = profileData.vitals;
      setVitalsForm({
        bpSystolic: bpSystolic ? String(bpSystolic) : "",
        bpDiastolic: bpDiastolic ? String(bpDiastolic) : "",
        bloodSugar: bloodSugar ? String(bloodSugar) : "",
        temperature: temperature ? String(temperature) : "",
      });
    } else {
      setVitalsForm({ bpSystolic: "", bpDiastolic: "", bloodSugar: "", temperature: "" });
    }
    setVitalsModalVisible(true);
  };

  const handleSaveVitals = async () => {
    const { bpSystolic, bpDiastolic, bloodSugar, temperature } = vitalsForm;

    if (!bpSystolic && !bpDiastolic && !bloodSugar && !temperature) {
      Alert.alert("Error", "Please enter at least one vital sign.");
      return;
    }
    if ((bpSystolic && !bpDiastolic) || (!bpSystolic && bpDiastolic)) {
      Alert.alert("Error", "Please enter both Systolic and Diastolic values for Blood Pressure.");
      return;
    }

    try {
      setSavingVitals(true);
      const payload = {
        bpSystolic: bpSystolic ? Number(bpSystolic) : undefined,
        bpDiastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
        bloodSugar: bloodSugar ? Number(bloodSugar) : undefined,
        temperature: temperature ? Number(temperature) : undefined,
        recordedAt: new Date().toISOString(),
      };

      const updatedVitals = await updateVitalSigns(payload);

      setProfileData((prev) => ({
        ...prev,
        vitals: updatedVitals.vitals || updatedVitals,
      }));

      setVitalsModalVisible(false);
      Alert.alert("Saved! ✅", "Your vital signs have been updated.");
    } catch (error) {
      console.error("❌ Error saving vitals:", error);
      Alert.alert("Save Failed", error.message || "Could not save vitals. Please try again.");
    } finally {
      setSavingVitals(false);
    }
  };

  const formatBP = (vitals) => {
    if (!vitals?.bpSystolic || !vitals?.bpDiastolic) return "N/A";
    return `${vitals.bpSystolic}/${vitals.bpDiastolic}`;
  };

  // BMI real-time calculate — height (ft) aur weight (kg) se
  const calculateBMI = (height, weight) => {
    if (!height || !weight) return null;
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) return null;
    const heightInMeters = h * 0.3048;
    const bmi = w / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading || !profileData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (navigation?.goBack ? navigation.goBack() : router.back())}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={{ marginTop: 16, color: "#6B7280", fontSize: 16 }}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Real-time BMI ─────────────────────────────────────────────────────────
  const liveBMI = calculateBMI(profileData.height, profileData.weight);

  // ── Health Summary — sirf wahi dikhao jo database mein actually hai ───────
  // New user ke liye sab blank/zero aayega, koi fake data nahi
  const dayMonitored = profileData.dayMonitored ?? 0;
  const normalReadings = profileData.normalReadings || null; // null = "Not recorded yet"
  const alerts = profileData.alerts ?? 0;
  const healthScore = profileData.healthScore || null; // null = "N/A"

  // Check karo patient ne kuch add kiya hai ya nahi
  const hasPersonalInfo =
    profileData.age ||
    profileData.gender ||
    profileData.dateOfBirth ||
    profileData.phone ||
    profileData.address;

  const hasMedicalInfo =
    profileData.bloodType ||
    profileData.height ||
    profileData.weight ||
    profileData.allergies ||
    profileData.medicalHistory;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (navigation?.goBack ? navigation.goBack() : router.back())}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.headerEditButton}
          onPress={() => {
            if (!profileData) return;
            router.push({
              pathname: "/Screens/EditProfile/EditProfile",
              params: { profileData: JSON.stringify(profileData) },
            });
          }}
        >
          <Text style={styles.headerEditText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickProfilePhoto}
            activeOpacity={0.8}
            disabled={uploadingPhoto}
          >
            <View style={styles.avatar}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <User size={40} color="#3B82F6" />
              )}
              {uploadingPhoto && (
                <View style={styles.avatarUploadOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.avatarCameraBadge}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>
            {profileData.fullName || profileData.name || "User"}
          </Text>
          <Text style={styles.profileId}>
            Patient ID: {profileData.patientId || "N/A"}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {profileData.status || "Active"}
              </Text>
            </View>
            {profileData.monitoringSince ? (
              <Text style={styles.monitoringText}>
                Monitoring Since {profileData.monitoringSince}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── VITAL SIGNS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Vital Signs</Text>
            <TouchableOpacity style={styles.updateVitalsBtn} onPress={openVitalsModal}>
              <Text style={styles.updateVitalsBtnText}>+ Update Now</Text>
            </TouchableOpacity>
          </View>

          {profileData.vitals &&
          (profileData.vitals.bpSystolic ||
            profileData.vitals.bloodSugar ||
            profileData.vitals.temperature) ? (
            <View style={styles.vitalsCard}>
              {/* Blood Pressure */}
              <View style={styles.vitalItem}>
                <View style={[styles.vitalIconBox, { backgroundColor: "#FCEBEB" }]}>
                  <Heart size={20} color="#E24B4A" />
                </View>
                <Text style={styles.vitalValue}>{formatBP(profileData.vitals)}</Text>
                <Text style={styles.vitalUnit}>mmHg</Text>
                <Text style={styles.vitalLabel}>Blood{"\n"}Pressure</Text>
                {profileData.vitals?.recordedAt && (
                  <Text style={styles.vitalTime}>
                    {formatTimeAgo(profileData.vitals.recordedAt)}
                  </Text>
                )}
              </View>

              <View style={styles.vitalDivider} />

              {/* Blood Sugar */}
              <View style={styles.vitalItem}>
                <View style={[styles.vitalIconBox, { backgroundColor: "#FAEEDA" }]}>
                  <Droplets size={20} color="#BA7517" />
                </View>
                <Text style={styles.vitalValue}>
                  {profileData.vitals?.bloodSugar ?? "N/A"}
                </Text>
                <Text style={styles.vitalUnit}>mg/dL</Text>
                <Text style={styles.vitalLabel}>Blood{"\n"}Sugar</Text>
                {profileData.vitals?.recordedAt && (
                  <Text style={styles.vitalTime}>
                    {formatTimeAgo(profileData.vitals.recordedAt)}
                  </Text>
                )}
              </View>

              <View style={styles.vitalDivider} />

              {/* Temperature */}
              <View style={styles.vitalItem}>
                <View style={[styles.vitalIconBox, { backgroundColor: "#EAF3DE" }]}>
                  <Thermometer size={20} color="#3B6D11" />
                </View>
                <Text style={styles.vitalValue}>
                  {profileData.vitals?.temperature ?? "N/A"}
                </Text>
                <Text style={styles.vitalUnit}>°F</Text>
                <Text style={styles.vitalLabel}>Body{"\n"}Temp</Text>
                {profileData.vitals?.recordedAt && (
                  <Text style={styles.vitalTime}>
                    {formatTimeAgo(profileData.vitals.recordedAt)}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            /* Naya user — koi vitals nahi, sirf banner dikhao */
            <View style={styles.noVitalsBanner}>
              <AlertTriangle size={16} color="#BA7517" />
              <Text style={styles.noVitalsText}>
                No vitals recorded yet. Tap "+ Update Now" to add your first reading.
              </Text>
            </View>
          )}
        </View>

        {/* ── Personal Information ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              label="Full Name"
              value={
                profileData.fullName || profileData.name
                  ? (profileData.fullName || profileData.name)
                  : null
              }
            />
            <InfoRow
              label="Age"
              value={
                profileData.age && String(profileData.age).trim() !== ""
                  ? `${profileData.age} years`
                  : null
              }
            />
            <InfoRow
              label="Gender"
              value={
                profileData.gender && profileData.gender.trim() !== ""
                  ? profileData.gender
                  : null
              }
            />
            <InfoRow
              label="Date of Birth"
              value={
                profileData.dateOfBirth && profileData.dateOfBirth.trim() !== ""
                  ? profileData.dateOfBirth
                  : null
              }
              icon={Calendar}
            />
            <InfoRow
              label="Phone"
              value={
                profileData.phone && profileData.phone.trim() !== ""
                  ? profileData.phone
                  : null
              }
              icon={Phone}
            />
            <InfoRow
              label="Address"
              value={
                profileData.address && profileData.address.trim() !== ""
                  ? profileData.address
                  : null
              }
              icon={MapPin}
              isLast
            />
          </View>

          {/* Agar koi personal info nahi hai toh hint dikhao */}
          {!hasPersonalInfo && (
            <View style={styles.emptyHint}>
              <Text style={styles.emptyHintText}>
                Tap "Edit" to fill in your personal details.
              </Text>
            </View>
          )}
        </View>

        {/* ── Medical Information ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              label="Blood Type"
              value={
                profileData.bloodType && profileData.bloodType.trim() !== ""
                  ? profileData.bloodType
                  : null
              }
            />
            <InfoRow
              label="Height"
              value={
                profileData.height && String(profileData.height).trim() !== ""
                  ? `${profileData.height} ft`
                  : null
              }
            />
            <InfoRow
              label="Weight"
              value={
                profileData.weight && String(profileData.weight).trim() !== ""
                  ? `${profileData.weight} kg`
                  : null
              }
            />

            {/* BMI — sirf tab dikhao jab height aur weight dono ho */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>BMI</Text>
              <View style={styles.bmiContainer}>
                {liveBMI ? (
                  <>
                    <Text style={styles.infoValue}>{liveBMI}</Text>
                    <View
                      style={[
                        styles.bmiBadge,
                        { backgroundColor: getBMIBadgeColor(liveBMI).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bmiBadgeText,
                          { color: getBMIBadgeColor(liveBMI).text },
                        ]}
                      >
                        {getBMIStatus(liveBMI)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.notSetText}>
                    Add height & weight
                  </Text>
                )}
              </View>
            </View>

            <InfoRow
              label="Allergies"
              value={
                profileData.allergies &&
                profileData.allergies.trim() !== "" &&
                profileData.allergies.toLowerCase() !== "none"
                  ? profileData.allergies
                  : null
              }
            />
            <InfoRow
              label="Medical History"
              value={
                profileData.medicalHistory &&
                profileData.medicalHistory.trim() !== "" &&
                profileData.medicalHistory.toLowerCase() !== "none"
                  ? profileData.medicalHistory
                  : null
              }
              isLast
            />
          </View>

          {/* Agar koi medical info nahi hai toh hint dikhao */}
          {!hasMedicalInfo && (
            <View style={styles.emptyHint}>
              <Text style={styles.emptyHintText}>
                Tap "Edit" to add your medical details.
              </Text>
            </View>
          )}
        </View>

        {/* ── Health Summary ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Summary</Text>

          {/* Naya user — agar sab zero/null hai toh ek info banner dikhao */}
          {dayMonitored === 0 && !normalReadings && alerts === 0 && !healthScore ? (
            <View style={styles.healthSummaryEmptyBanner}>
              <Activity size={18} color="#3B82F6" />
              <Text style={styles.healthSummaryEmptyText}>
                Your health summary will appear here as you use the app and log your vitals.
              </Text>
            </View>
          ) : (
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: "#DBEAFE" }]}>
                <Text style={styles.summaryValue}>{dayMonitored}</Text>
                <Text style={styles.summaryLabel}>Days Monitored</Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: "#D1FAE5" }]}>
                <Text style={styles.summaryValue}>
                  {normalReadings || "—"}
                </Text>
                <Text style={styles.summaryLabel}>Normal Readings</Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: "#FEF3C7" }]}>
                <View style={styles.alertBadge}>
                  <AlertTriangle size={16} color="#F59E0B" />
                  <Text style={[styles.summaryValue, { fontSize: 28 }]}>{alerts}</Text>
                </View>
                <Text style={styles.summaryLabel}>Alerts this month</Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: "#D1FAE5" }]}>
                <View style={styles.scoreBadge}>
                  <Activity size={20} color="#10B981" />
                  <Text
                    style={[styles.summaryValue, { fontSize: 28, color: "#10B981" }]}
                  >
                    {healthScore || "—"}
                  </Text>
                </View>
                <Text style={styles.summaryLabel}>Health Score</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Footer />

      {/* ── VITALS MODAL ── */}
      <Modal
        visible={vitalsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVitalsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setVitalsModalVisible(false)}
          />

          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Update Vital Signs</Text>
                <Text style={styles.modalSubtitle}>Enter your current readings</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setVitalsModalVisible(false)}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Blood Pressure */}
            <View style={styles.formGroup}>
              <View style={styles.formLabelRow}>
                <View style={[styles.formDot, { backgroundColor: "#E24B4A" }]} />
                <Text style={styles.formLabel}>Blood Pressure (mmHg)</Text>
              </View>
              <View style={styles.bpRow}>
                <View style={styles.bpInputWrapper}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Systolic (e.g. 120)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={vitalsForm.bpSystolic}
                    onChangeText={(v) =>
                      setVitalsForm((f) => ({ ...f, bpSystolic: v }))
                    }
                    maxLength={3}
                  />
                  <Text style={styles.bpSlash}>/</Text>
                </View>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="Diastolic (e.g. 80)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={vitalsForm.bpDiastolic}
                  onChangeText={(v) =>
                    setVitalsForm((f) => ({ ...f, bpDiastolic: v }))
                  }
                  maxLength={3}
                />
              </View>
            </View>

            {/* Blood Sugar */}
            <View style={styles.formGroup}>
              <View style={styles.formLabelRow}>
                <View style={[styles.formDot, { backgroundColor: "#EF9F27" }]} />
                <Text style={styles.formLabel}>Blood Sugar (mg/dL)</Text>
              </View>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 95"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={vitalsForm.bloodSugar}
                onChangeText={(v) =>
                  setVitalsForm((f) => ({ ...f, bloodSugar: v }))
                }
                maxLength={4}
              />
            </View>

            {/* Temperature */}
            <View style={styles.formGroup}>
              <View style={styles.formLabelRow}>
                <View style={[styles.formDot, { backgroundColor: "#639922" }]} />
                <Text style={styles.formLabel}>Body Temperature (°F)</Text>
              </View>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 98.6"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={vitalsForm.temperature}
                onChangeText={(v) =>
                  setVitalsForm((f) => ({ ...f, temperature: v }))
                }
                maxLength={5}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, savingVitals && styles.saveBtnDisabled]}
              onPress={handleSaveVitals}
              disabled={savingVitals}
            >
              {savingVitals ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Readings</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTimeAgo = (isoString) => {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getBMIStatus = (bmi) => {
  if (!bmi) return "N/A";
  const v = parseFloat(bmi);
  if (v < 18.5) return "Underweight";
  if (v < 25) return "Normal";
  if (v < 30) return "Overweight";
  return "Obese";
};

const getBMIBadgeColor = (bmi) => {
  const v = parseFloat(bmi);
  if (v < 18.5) return { bg: "#DBEAFE", text: "#1D4ED8" };
  if (v < 25) return { bg: "#D1FAE5", text: "#10B981" };
  if (v < 30) return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#FEE2E2", text: "#EF4444" };
};

// ─── InfoRow — agar value null/empty hai to "Not set" dikhao ─────────────────
const InfoRow = ({ label, value, icon: Icon, isLast = false }) => (
  <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <View style={styles.infoValueContainer}>
      {Icon && value ? <Icon size={14} color="#6B7280" style={styles.infoIcon} /> : null}
      <Text
        style={[styles.infoValue, !value && styles.notSetText]}
        numberOfLines={2}
      >
        {value || "Not set"}
      </Text>
    </View>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  headerEditButton: { paddingHorizontal: 12, paddingVertical: 6 },
  headerEditText: { fontSize: 16, fontWeight: "600", color: "#3B82F6" },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },

  // Profile card
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    margin: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarContainer: { marginBottom: 16, position: "relative" },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarUploadOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
  },
  avatarCameraBadge: {
    position: "absolute",
    bottom: 0, right: 0,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileName: { fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 4 },
  profileId: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981", marginRight: 6 },
  statusText: { fontSize: 14, fontWeight: "600", color: "#10B981" },
  monitoringText: { fontSize: 12, color: "#6B7280" },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#111827", marginBottom: 12 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  updateVitalsBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#3B82F6",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  updateVitalsBtnText: { fontSize: 13, fontWeight: "600", color: "#3B82F6" },

  // Vitals card
  vitalsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: "hidden",
  },
  vitalItem: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 },
  vitalDivider: { width: 1, backgroundColor: "#F3F4F6", marginVertical: 12 },
  vitalIconBox: {
    width: 38, height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  vitalValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  vitalUnit: { fontSize: 10, color: "#9CA3AF", marginTop: 1 },
  vitalLabel: { fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 4, lineHeight: 15 },
  vitalTime: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },

  noVitalsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAEEDA",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  noVitalsText: { fontSize: 12, color: "#854F0B", flex: 1, lineHeight: 18 },

  // Info card
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoLabel: { fontSize: 14, color: "#6B7280", flex: 1 },
  infoValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1.5,
    justifyContent: "flex-end",
  },
  infoIcon: { marginRight: 6 },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#111827", textAlign: "right", flex: 1 },
  notSetText: { fontSize: 13, color: "#9CA3AF", fontStyle: "italic", textAlign: "right", flex: 1 },

  bmiContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1.5,
    justifyContent: "flex-end",
  },
  bmiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bmiBadgeText: { fontSize: 11, fontWeight: "600" },

  // Empty hint below info cards
  emptyHint: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  emptyHintText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },

  // Health Summary — empty state
  healthSummaryEmptyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  healthSummaryEmptyText: {
    fontSize: 13,
    color: "#1D4ED8",
    flex: 1,
    lineHeight: 20,
  },

  // Summary grid
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryCard: {
    width: "48%",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryValue: { fontSize: 32, fontWeight: "bold", color: "#111827", marginBottom: 4 },
  summaryLabel: { fontSize: 12, color: "#6B7280", textAlign: "center" },
  alertBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalPanel: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  modalCloseBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  formGroup: { marginBottom: 16 },
  formLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  formDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  formLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  formInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FAFAFA",
  },
  bpRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bpInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center" },
  bpSlash: { fontSize: 22, color: "#9CA3AF", marginLeft: 8 },
  saveBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
