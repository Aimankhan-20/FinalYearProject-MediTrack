// Path: app/Screens/HealthReport/HealthReport.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Heart,
  Thermometer,
  Wind,
  Activity,
  Footprints,
  Moon,
  TrendingUp,
  CheckCircle,
  Download,
  Share2,
  AlertTriangle,
  Calendar,
  Clock,
  X,
  Droplets,
  Scale,
  Gauge,
  Shield,
  Zap,
  Target,
  BarChart2,
  Award,
  TrendingDown,
} from "lucide-react-native";
import { Share } from "react-native";
import Footer from "../components/Footer";
import { getProfile } from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_BASE_URL } from '../../constants/constants';
const API_URL = `${API_BASE_URL}/api`;

const getToken = async () => AsyncStorage.getItem("userToken");

// ─── Fetch helpers ────────────────────────────────────────────────────────────
const fetchLatestVitals = async () => {
  const token = await getToken();
  const res = await fetch(`${API_URL}/vitals/latest`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error("Failed to fetch latest vitals");
  return json.data;
};

const fetchHistory = async (days = 30) => {
  const token = await getToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const url = `${API_URL}/vitals/history?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=2000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error("Failed to fetch history");
  return json.data;
};

const fetchHistoryByRange = async (startDate, endDate) => {
  const token = await getToken();
  const url = `${API_URL}/vitals/history?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=5000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error("Failed to fetch history");
  return json.data;
};

const fetchStats = async () => {
  const token = await getToken();
  const res = await fetch(`${API_URL}/vitals/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error("Failed to fetch stats");
  return json.stats;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const avg = (arr, key) => {
  const vals = arr.map((r) => r[key] || 0).filter((v) => v > 0);
  if (!vals.length) return 0;
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
};

const getStatusForHR = (v) => (v >= 60 && v <= 100 ? "Normal" : v < 60 ? "Low" : "High");
const getStatusForSpo2 = (v) => (v >= 95 ? "Normal" : v >= 90 ? "Warning" : "Critical");
const getStatusForTemp = (v) => {
  if (v >= 36.1 && v <= 37.2) return "Normal";
  if (v > 37.2 && v <= 38) return "Warning";
  if (v > 38) return "Critical";
  return "Low";
};
const getStatusForBP = (systolic) => {
  if (!systolic) return "N/A";
  if (systolic < 90) return "Low";
  if (systolic <= 120) return "Normal";
  if (systolic <= 139) return "Warning";
  return "High";
};
const getStatusForBloodSugar = (v) => {
  if (!v) return "N/A";
  if (v < 70) return "Low";
  if (v <= 99) return "Normal";
  if (v <= 125) return "Warning";
  return "High";
};
const getStatusForBMI = (v) => {
  if (!v) return "N/A";
  if (v < 18.5) return "Low";
  if (v <= 24.9) return "Normal";
  if (v <= 29.9) return "Warning";
  return "High";
};

const celsiusToF = (c) => parseFloat(((c * 9) / 5 + 32).toFixed(1));

const calcHealthScore = (readings) => {
  if (!readings.length) return 0;
  const normal = readings.filter((r) => r.alertLevel === "normal" || r.condition === "Normal").length;
  return Math.round((normal / readings.length) * 100);
};

// Build hourly grouped data
const buildHourlyVitals = (history) => {
  const byHour = {};
  history.forEach((r) => {
    const h = new Date(r.timestamp).getHours();
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(r);
  });

  return Array.from({ length: 24 }, (_, i) => {
    const records = byHour[i] || [];
    if (!records.length) return { hour: i, hasData: false };
    return {
      hour: i,
      hasData: true,
      heartRate: avg(records, "heartRate"),
      bloodOxygen: avg(records, "bloodOxygen"),
      temperature: avg(records, "temperature"),
      footsteps: records.reduce((s, r) => s + (r.footsteps || 0), 0),
      bloodPressureSystolic: avg(records, "bloodPressureSystolic"),
      bloodPressureDiastolic: avg(records, "bloodPressureDiastolic"),
      bloodSugar: avg(records, "bloodSugar"),
      bmi: avg(records, "bmi"),
      count: records.length,
    };
  }).filter((r) => r.hasData);
};

// Build hourly arrays for multi-vital trend chart
const buildHourlyDataForVital = (history, key) => {
  const byHour = {};
  history.forEach((r) => {
    const h = new Date(r.timestamp).getHours();
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(r[key] || 0);
  });
  return Array.from({ length: 24 }, (_, i) => {
    const vals = (byHour[i] || []).filter((v) => v > 0);
    const value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { hour: i, value };
  });
};

// Build daily summary for 30-days view
const buildDailySummary = (history) => {
  const byDay = {};
  history.forEach((r) => {
    const d = new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(r);
  });
  return Object.entries(byDay)
    .map(([date, records]) => ({
      date,
      heartRate: avg(records, "heartRate"),
      bloodOxygen: avg(records, "bloodOxygen"),
      temperature: avg(records, "temperature"),
      footsteps: records.reduce((s, r) => s + (r.footsteps || 0), 0),
      bloodPressureSystolic: avg(records, "bloodPressureSystolic"),
      bloodSugar: avg(records, "bloodSugar"),
      bmi: avg(records, "bmi"),
      normalCount: records.filter((r) => r.alertLevel === "normal").length,
      total: records.length,
    }))
    .reverse()
    .slice(-30);
};

const buildInsights = (history, stats) => {
  const insights = [];
  if (stats?.totalSteps > 0) {
    const dailyAvgSteps = Math.round(stats.totalSteps / 30);
    insights.push({
      id: 1,
      icon: Footprints,
      color: "#3B82F6",
      bgColor: "#DBEAFE",
      text: `Avg daily steps: ${dailyAvgSteps.toLocaleString()}. ${dailyAvgSteps >= 8000 ? "Great activity level!" : "Try to reach 8,000 steps/day."}`,
    });
  }
  if (stats?.avgHeartRate) {
    insights.push({
      id: 2,
      icon: Heart,
      color: "#EF4444",
      bgColor: "#FEE2E2",
      text: `Avg heart rate: ${stats.avgHeartRate} bpm — ${stats.avgHeartRate >= 60 && stats.avgHeartRate <= 100 ? "within healthy range." : "consult your doctor."}`,
    });
  }
  if (stats?.avgBloodOxygen) {
    insights.push({
      id: 3,
      icon: Wind,
      color: "#10B981",
      bgColor: "#D1FAE5",
      text: `Blood oxygen averaging ${stats.avgBloodOxygen}% — ${stats.avgBloodOxygen >= 95 ? "excellent saturation." : "slightly low, monitor closely."}`,
    });
  }
  const avgBS = avg(history, "bloodSugar");
  if (avgBS > 0) {
    insights.push({
      id: 4,
      icon: Droplets,
      color: "#8B5CF6",
      bgColor: "#EDE9FE",
      text: `Avg blood sugar: ${avgBS} mg/dL — ${avgBS <= 99 ? "within normal fasting range." : avgBS <= 125 ? "slightly elevated, watch diet." : "high — consult your doctor."}`,
    });
  }
  return insights;
};

// ─── Status colors ────────────────────────────────────────────────────────────
const statusColor = (s) =>
  ({ Normal: "#10B981", Warning: "#F59E0B", Critical: "#EF4444", Low: "#F59E0B", High: "#EF4444", Moderate: "#F59E0B", Active: "#10B981" }[s] || "#6B7280");
const statusBg = (s) =>
  ({ Normal: "#D1FAE5", Warning: "#FEF3C7", Critical: "#FEE2E2", Low: "#FEF3C7", High: "#FEE2E2", Moderate: "#FEF3C7", Active: "#D1FAE5" }[s] || "#F3F4F6");

const formatHour = (h) => {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
};

// ─── Auto-format date input (YYYY-MM-DD) ─────────────────────────────────────
const formatDateInput = (text, prevText) => {
  // Remove all non-digit characters
  const digits = text.replace(/\D/g, "");
  
  // Handle backspace - if user is deleting
  if (text.length < prevText.length) {
    // If they just deleted a hyphen, also delete the digit before it
    if (prevText[prevText.length - 1] === "-") {
      return digits.slice(0, -1).replace(/^(\d{4})(\d{0,2})/, (_, y, m) =>
        m ? `${y}-${m}` : y
      );
    }
    return text;
  }

  let formatted = "";
  if (digits.length <= 4) {
    formatted = digits;
  } else if (digits.length <= 6) {
    formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else {
    formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return formatted;
};

// ─── Mini Bar Chart Component ─────────────────────────────────────────────────
function MiniBarChart({ data, color, maxOverride }) {
  const validVals = data.map((d) => d.value || 0).filter((v) => v > 0);
  const maxVal = maxOverride || (validVals.length ? Math.max(...validVals) * 1.1 : 100);
  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.bars}>
        {data.map((point, i) => {
          const height = point.value ? Math.max(3, (point.value / maxVal) * 100) : 3;
          const hasData = !!point.value;
          return (
            <View key={i} style={{ alignItems: "center", flex: 1 }}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: `${height}%`,
                    backgroundColor: hasData ? color : "#E5E7EB",
                    opacity: hasData ? 1 : 0.4,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={chartStyles.labels}>
        {[0, 6, 12, 18, 23].map((h) => (
          <Text key={h} style={chartStyles.label}>
            {h === 0 ? "12a" : h === 6 ? "6a" : h === 12 ? "12p" : h === 18 ? "6p" : "11p"}
          </Text>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { height: 90, marginTop: 6 },
  bars: { flexDirection: "row", alignItems: "flex-end", height: "82%" },
  bar: { borderRadius: 2, marginHorizontal: 0.5 },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  label: { fontSize: 9, color: "#9CA3AF" },
});

// ─── Vital Summary Stats Below Charts ────────────────────────────────────────
function VitalHealthSummary({ history24h, latestVitals }) {
  const d = latestVitals || {};
  const hr = d.heartRate || 0;
  const spo2 = d.bloodOxygen || 0;
  const tempC = d.temperature || 0;
  const bpSys = d.bloodPressureSystolic || 0;
  const bloodSugar = d.bloodSugar || 0;
  const bmi = d.bmi || 0;

  const alertCount = history24h.filter((r) => r.alertLevel !== "normal").length;
  const normalCount = history24h.filter((r) => r.alertLevel === "normal").length;
  const normalPct = history24h.length ? Math.round((normalCount / history24h.length) * 100) : 0;
  const steps24 = history24h.reduce((s, r) => s + (r.footsteps || 0), 0);

  const cards = [
    {
      icon: Shield,
      color: normalPct >= 80 ? "#10B981" : "#F59E0B",
      bg: normalPct >= 80 ? "#D1FAE5" : "#FEF3C7",
      label: "Normal Rate",
      value: `${normalPct}%`,
      sub: `${normalCount} of ${history24h.length} readings`,
    },
    {
      icon: AlertTriangle,
      color: alertCount === 0 ? "#10B981" : "#EF4444",
      bg: alertCount === 0 ? "#D1FAE5" : "#FEE2E2",
      label: "Alerts Today",
      value: `${alertCount}`,
      sub: alertCount === 0 ? "All readings normal" : "Needs attention",
    },
    {
      icon: Footprints,
      color: "#3B82F6",
      bg: "#DBEAFE",
      label: "Steps Today",
      value: steps24.toLocaleString(),
      sub: steps24 >= 8000 ? "Goal achieved! 🎉" : `${(8000 - steps24).toLocaleString()} more to goal`,
    },
    {
      icon: Heart,
      color: hr > 0 ? statusColor(getStatusForHR(hr)) : "#6B7280",
      bg: hr > 0 ? statusBg(getStatusForHR(hr)) : "#F3F4F6",
      label: "Current HR",
      value: hr > 0 ? `${hr} bpm` : "—",
      sub: hr > 0 ? getStatusForHR(hr) : "No recent data",
    },
    {
      icon: Wind,
      color: spo2 > 0 ? statusColor(getStatusForSpo2(spo2)) : "#6B7280",
      bg: spo2 > 0 ? statusBg(getStatusForSpo2(spo2)) : "#F3F4F6",
      label: "Blood Oxygen",
      value: spo2 > 0 ? `${spo2}%` : "—",
      sub: spo2 > 0 ? getStatusForSpo2(spo2) : "No recent data",
    },
    {
      icon: Gauge,
      color: bpSys > 0 ? statusColor(getStatusForBP(bpSys)) : "#6B7280",
      bg: bpSys > 0 ? statusBg(getStatusForBP(bpSys)) : "#F3F4F6",
      label: "Blood Pressure",
      value: bpSys > 0 ? `${bpSys} sys` : "—",
      sub: bpSys > 0 ? getStatusForBP(bpSys) : "No recent data",
    },
  ];

  return (
    <View style={vhsStyles.card}>
      <View style={vhsStyles.titleRow}>
        <BarChart2 size={18} color="#3B82F6" />
        <Text style={vhsStyles.title}>Today's Health Summary</Text>
      </View>
      <Text style={vhsStyles.subtitle}>Live stats from your last 24 hours of data</Text>
      <View style={vhsStyles.grid}>
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <View key={i} style={[vhsStyles.box, { borderLeftColor: c.color }]}>
              <View style={[vhsStyles.iconWrap, { backgroundColor: c.bg }]}>
                <Icon size={16} color={c.color} />
              </View>
              <Text style={vhsStyles.value}>{c.value}</Text>
              <Text style={vhsStyles.label}>{c.label}</Text>
              <Text style={[vhsStyles.sub, { color: c.color }]}>{c.sub}</Text>
            </View>
          );
        })}
      </View>

      {/* Quick health tip */}
      <View style={vhsStyles.tipBox}>
        <Text style={vhsStyles.tipIcon}>💡</Text>
        <Text style={vhsStyles.tipText}>
          {steps24 < 4000
            ? "Try a short 10-minute walk to boost your step count and improve circulation."
            : steps24 < 8000
            ? "You're halfway to your step goal! Keep moving for better cardiovascular health."
            : "Excellent activity today! Consistent movement reduces risk of chronic disease."}
        </Text>
      </View>
    </View>
  );
}

const vhsStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  title: { fontSize: 17, fontWeight: "bold", color: "#111827" },
  subtitle: { fontSize: 11, color: "#9CA3AF", marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  box: {
    width: "47%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  value: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 2 },
  label: { fontSize: 11, color: "#6B7280", marginBottom: 2 },
  sub: { fontSize: 10, fontWeight: "600" },
  tipBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginTop: 14, gap: 8 },
  tipIcon: { fontSize: 16 },
  tipText: { flex: 1, fontSize: 12, color: "#1D4ED8", lineHeight: 18 },
});

// ─── 30-Day Health Timeline Card ──────────────────────────────────────────────
function HealthTimeline({ dailySummary }) {
  const [selectedVital, setSelectedVital] = useState("heartRate");
  const vitals = [
    { key: "heartRate", label: "HR", unit: "bpm", color: "#EF4444" },
    { key: "bloodOxygen", label: "SpO₂", unit: "%", color: "#3B82F6" },
    { key: "temperature", label: "Temp", unit: "°C", color: "#F59E0B" },
    { key: "bloodPressureSystolic", label: "BP", unit: "sys", color: "#8B5CF6" },
    { key: "bloodSugar", label: "Sugar", unit: "mg/dL", color: "#10B981" },
  ];
  const selected = vitals.find((v) => v.key === selectedVital);
  const vals = dailySummary.map((d) => d[selectedVital] || 0).filter((v) => v > 0);
  const maxVal = vals.length ? Math.max(...vals) * 1.15 : 100;
  const minVal = vals.length ? Math.min(...vals) * 0.9 : 0;

  return (
    <View style={tlStyles.card}>
      <Text style={tlStyles.title}>30-Day Health Timeline</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tlStyles.tabRow}>
        {vitals.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={[tlStyles.tab, selectedVital === v.key && { backgroundColor: v.color }]}
            onPress={() => setSelectedVital(v.key)}
          >
            <Text style={[tlStyles.tabText, selectedVital === v.key && { color: "#fff" }]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {dailySummary.length === 0 ? (
        <Text style={tlStyles.noData}>No data available for last 30 days</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={tlStyles.chartArea}>
            <View style={tlStyles.barsRow}>
              {dailySummary.map((day, i) => {
                const val = day[selectedVital] || 0;
                const heightPct = val ? Math.max(5, ((val - minVal) / (maxVal - minVal || 1)) * 100) : 5;
                return (
                  <View key={i} style={tlStyles.barCol}>
                    <Text style={tlStyles.barVal}>{val ? (selectedVital === "temperature" ? celsiusToF(val) : val) : ""}</Text>
                    <View style={tlStyles.barTrack}>
                      <View
                        style={[
                          tlStyles.barFill,
                          {
                            height: `${heightPct}%`,
                            backgroundColor: val ? selected.color : "#E5E7EB",
                          },
                        ]}
                      />
                    </View>
                    <Text style={tlStyles.barDate}>{day.date.replace(" ", "\n")}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  title: { fontSize: 17, fontWeight: "bold", color: "#111827", marginBottom: 12 },
  tabRow: { flexDirection: "row", marginBottom: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F3F4F6", marginRight: 8 },
  tabText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  chartArea: { paddingBottom: 4 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", height: 130, gap: 4 },
  barCol: { width: 36, alignItems: "center" },
  barVal: { fontSize: 8, color: "#6B7280", marginBottom: 2 },
  barTrack: { flex: 1, width: 20, backgroundColor: "#F3F4F6", borderRadius: 4, justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barDate: { fontSize: 8, color: "#9CA3AF", textAlign: "center", marginTop: 4, lineHeight: 10 },
  noData: { color: "#9CA3AF", textAlign: "center", paddingVertical: 20 },
});

// ─── Vital Highlights Card (replaces 30-day averages) ────────────────────────
function VitalHighlightsCard({ history30d, stats, latestVitals }) {
  const d = latestVitals || {};

  // Real-time latest values
  const currentHR = d.heartRate || 0;
  const currentSpo2 = d.bloodOxygen || 0;
  const currentTempC = d.temperature || 0;
  const currentBpSys = d.bloodPressureSystolic || 0;
  const currentBpDia = d.bloodPressureDiastolic || 0;
  const currentBS = d.bloodSugar || 0;
  const currentBMI = d.bmi || 0;

  // 30d computed
  const avgHR = avg(history30d, "heartRate");
  const avgSpo2 = avg(history30d, "bloodOxygen");
  const avgTempC = avg(history30d, "temperature");
  const avgTempF = avgTempC ? celsiusToF(avgTempC) : 0;
  const currentTempF = currentTempC ? celsiusToF(currentTempC) : 0;
  const avgBpSys = avg(history30d, "bloodPressureSystolic");
  const avgBS = avg(history30d, "bloodSugar");
  const avgBMI = avg(history30d, "bmi");
  const totalSteps = history30d.reduce((s, r) => s + (r.footsteps || 0), 0);
  const dailySteps = history30d.length ? Math.round(totalSteps / 30) : 0;

  const vitals = [
    {
      icon: Heart,
      label: "Heart Rate",
      current: currentHR ? `${currentHR} bpm` : "—",
      avg: avgHR ? `${avgHR} bpm` : "—",
      status: currentHR ? getStatusForHR(currentHR) : avgHR ? getStatusForHR(avgHR) : "N/A",
      color: "#EF4444",
      ref: "60–100 bpm",
    },
    {
      icon: Wind,
      label: "Blood Oxygen",
      current: currentSpo2 ? `${currentSpo2}%` : "—",
      avg: avgSpo2 ? `${avgSpo2}%` : "—",
      status: currentSpo2 ? getStatusForSpo2(currentSpo2) : avgSpo2 ? getStatusForSpo2(avgSpo2) : "N/A",
      color: "#3B82F6",
      ref: "≥ 95%",
    },
    {
      icon: Thermometer,
      label: "Temperature",
      current: currentTempF ? `${currentTempF}°F` : "—",
      avg: avgTempF ? `${avgTempF}°F` : "—",
      status: currentTempC ? getStatusForTemp(currentTempC) : avgTempC ? getStatusForTemp(avgTempC) : "N/A",
      color: "#F59E0B",
      ref: "97.0–98.9°F",
    },
    {
      icon: Activity,
      label: "Blood Pressure",
      current: currentBpSys && currentBpDia ? `${currentBpSys}/${currentBpDia}` : currentBpSys ? `${currentBpSys} sys` : "—",
      avg: avgBpSys ? `${avgBpSys} sys` : "—",
      status: currentBpSys ? getStatusForBP(currentBpSys) : avgBpSys ? getStatusForBP(avgBpSys) : "N/A",
      color: "#8B5CF6",
      ref: "< 120 systolic",
    },
    {
      icon: Droplets,
      label: "Blood Sugar",
      current: currentBS ? `${currentBS} mg/dL` : "—",
      avg: avgBS ? `${avgBS} mg/dL` : "—",
      status: currentBS ? getStatusForBloodSugar(currentBS) : avgBS ? getStatusForBloodSugar(avgBS) : "N/A",
      color: "#EC4899",
      ref: "70–99 mg/dL",
    },
    {
      icon: Scale,
      label: "BMI",
      current: currentBMI ? `${currentBMI}` : "—",
      avg: avgBMI ? `${avgBMI}` : "—",
      status: currentBMI ? getStatusForBMI(currentBMI) : avgBMI ? getStatusForBMI(avgBMI) : "N/A",
      color: "#06B6D4",
      ref: "18.5–24.9",
    },
    {
      icon: Footprints,
      label: "Daily Steps",
      current: "Live",
      avg: dailySteps ? dailySteps.toLocaleString() : "—",
      status: dailySteps >= 8000 ? "Active" : dailySteps > 0 ? "Moderate" : "N/A",
      color: "#10B981",
      ref: "≥ 8,000/day",
    },
  ];

  return (
    <View style={vhcStyles.card}>
      <View style={vhcStyles.headerRow}>
        <View>
          <Text style={vhcStyles.title}>Vitals at a Glance</Text>
          <Text style={vhcStyles.subtitle}>Current reading vs 30-day average</Text>
        </View>
        <View style={vhcStyles.liveBadge}>
          <View style={vhcStyles.liveDot} />
          <Text style={vhcStyles.liveText}>LIVE</Text>
        </View>
      </View>

      {vitals.map((v, i) => {
        const Icon = v.icon;
        const st = v.status;
        const isGood = st === "Normal" || st === "Active";
        return (
          <View key={i} style={[vhcStyles.row, i < vitals.length - 1 && vhcStyles.rowBorder]}>
            <View style={[vhcStyles.iconBox, { backgroundColor: v.color + "18" }]}>
              <Icon size={18} color={v.color} />
            </View>
            <View style={vhcStyles.info}>
              <Text style={vhcStyles.vLabel}>{v.label}</Text>
              <Text style={vhcStyles.refText}>Normal: {v.ref}</Text>
            </View>
            <View style={vhcStyles.vals}>
              <Text style={vhcStyles.currentVal}>{v.current}</Text>
              <Text style={vhcStyles.avgVal}>30d avg: {v.avg}</Text>
            </View>
            <View style={[vhcStyles.statusPill, { backgroundColor: statusBg(st) }]}>
              <Text style={[vhcStyles.statusPillText, { color: statusColor(st) }]}>{st}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const vhcStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 17, fontWeight: "bold", color: "#111827" },
  subtitle: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  liveText: { fontSize: 10, fontWeight: "800", color: "#EF4444", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  iconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  info: { flex: 1 },
  vLabel: { fontSize: 13, fontWeight: "600", color: "#111827" },
  refText: { fontSize: 10, color: "#9CA3AF", marginTop: 1 },
  vals: { alignItems: "flex-end", marginRight: 8 },
  currentVal: { fontSize: 14, fontWeight: "800", color: "#111827" },
  avgVal: { fontSize: 10, color: "#9CA3AF", marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 54, alignItems: "center" },
  statusPillText: { fontSize: 10, fontWeight: "700" },
});

// ─── Build PDF HTML ──────────────────────────────────────────────────────────
const buildPdfHtml = ({ profileData, rangeLabel, startDate, endDate, history, currentDate, currentTime, isHourly }) => {
  const patientName = profileData?.fullName || profileData?.name || "Patient";
  const patientId = profileData?.patientId || "N/A";
  const bloodType = profileData?.bloodType || "N/A";
  const dob = profileData?.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : "N/A";
  const gender = profileData?.gender || "N/A";
  const phone = profileData?.phone || profileData?.phoneNumber || "N/A";
  const email = profileData?.email || "N/A";
  const address = profileData?.address || "N/A";

  let rows = [];

  if (isHourly) {
    const byHour = {};
    history.forEach((r) => {
      const d = new Date(r.timestamp);
      const key = `${formatHour(d.getHours())}`;
      const keyFull = `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${key}`;
      if (!byHour[keyFull]) byHour[keyFull] = [];
      byHour[keyFull].push(r);
    });
    rows = Object.entries(byHour).map(([timeKey, records]) => {
      const hr = avg(records, "heartRate");
      const spo2 = avg(records, "bloodOxygen");
      const tempC = avg(records, "temperature");
      const tempF = tempC ? celsiusToF(tempC) : 0;
      const steps = records.reduce((s, r) => s + (r.footsteps || 0), 0);
      const bpSys = avg(records, "bloodPressureSystolic");
      const bpDia = avg(records, "bloodPressureDiastolic");
      const bs = avg(records, "bloodSugar");
      const bmi = avg(records, "bmi");
      return {
        timeKey, hr, spo2, tempF, steps, bpSys, bpDia, bs, bmi,
        hrStatus: hr ? getStatusForHR(hr) : "N/A",
        spo2Status: spo2 ? getStatusForSpo2(spo2) : "N/A",
        tempStatus: tempC ? getStatusForTemp(tempC) : "N/A",
        bpStatus: bpSys ? getStatusForBP(bpSys) : "N/A",
        bsStatus: bs ? getStatusForBloodSugar(bs) : "N/A",
        bmiStatus: bmi ? getStatusForBMI(bmi) : "N/A",
      };
    });
  } else {
    const byDay = {};
    history.forEach((r) => {
      const d = new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(r);
    });
    rows = Object.entries(byDay).map(([timeKey, records]) => {
      const hr = avg(records, "heartRate");
      const spo2 = avg(records, "bloodOxygen");
      const tempC = avg(records, "temperature");
      const tempF = tempC ? celsiusToF(tempC) : 0;
      const steps = records.reduce((s, r) => s + (r.footsteps || 0), 0);
      const bpSys = avg(records, "bloodPressureSystolic");
      const bpDia = avg(records, "bloodPressureDiastolic");
      const bs = avg(records, "bloodSugar");
      const bmi = avg(records, "bmi");
      return {
        timeKey, hr, spo2, tempF, steps, bpSys, bpDia, bs, bmi,
        hrStatus: hr ? getStatusForHR(hr) : "N/A",
        spo2Status: spo2 ? getStatusForSpo2(spo2) : "N/A",
        tempStatus: tempC ? getStatusForTemp(tempC) : "N/A",
        bpStatus: bpSys ? getStatusForBP(bpSys) : "N/A",
        bsStatus: bs ? getStatusForBloodSugar(bs) : "N/A",
        bmiStatus: bmi ? getStatusForBMI(bmi) : "N/A",
      };
    });
  }

  const tableRows = rows.map((r) => `
    <tr>
      <td>${r.timeKey}</td>
      <td>${r.hr || "—"} <span class="unit">bpm</span> <span class="status-${r.hrStatus.toLowerCase().replace("/","")}">${r.hrStatus}</span></td>
      <td>${r.spo2 || "—"} <span class="unit">%</span> <span class="status-${r.spo2Status.toLowerCase().replace("/","")}">${r.spo2Status}</span></td>
      <td>${r.tempF || "—"} <span class="unit">°F</span> <span class="status-${r.tempStatus.toLowerCase().replace("/","")}">${r.tempStatus}</span></td>
      <td>${r.steps.toLocaleString()}</td>
      <td>${r.bpSys && r.bpDia ? `${r.bpSys}/${r.bpDia}` : "—"} <span class="unit">mmHg</span> <span class="status-${r.bpStatus.toLowerCase().replace("/","")}">${r.bpStatus}</span></td>
      <td>${r.bs || "—"} <span class="unit">mg/dL</span> <span class="status-${r.bsStatus.toLowerCase().replace("/","")}">${r.bsStatus}</span></td>
      <td>${r.bmi || "—"} <span class="status-${r.bmiStatus.toLowerCase().replace("/","")}">${r.bmiStatus}</span></td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Meditrack Health Report</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding:20px; background:#fff; color:#111827; font-size:12px; }

    /* ── Header ── */
    .header { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #3B82F6; padding-bottom:14px; margin-bottom:16px; }
    .header-left h1 { color:#3B82F6; font-size:20px; }
    .header-left p { color:#6B7280; font-size:11px; margin-top:2px; }
    .range-badge { display:inline-block; background:#DBEAFE; color:#1D4ED8; padding:4px 14px; border-radius:20px; font-size:11px; font-weight:700; }

    /* ── Patient Info — column layout ── */
    .patient-section { background:#F8FAFF; border:1px solid #DBEAFE; border-radius:10px; margin-bottom:16px; overflow:hidden; }
    .patient-section-title { background:#3B82F6; color:#fff; font-size:11px; font-weight:700; padding:7px 14px; letter-spacing:0.5px; text-transform:uppercase; }
    .patient-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:0; }
    .patient-cell { padding:10px 14px; border-right:1px solid #DBEAFE; border-bottom:1px solid #DBEAFE; }
    .patient-cell:nth-child(4n) { border-right:none; }
    .patient-cell:nth-last-child(-n+4) { border-bottom:none; }
    .pi-label { font-size:9px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
    .pi-value { font-size:13px; font-weight:700; color:#111827; }

    /* ── Section title ── */
    .section-title { color:#111827; font-size:14px; font-weight:bold; margin-bottom:10px; padding-bottom:5px; border-bottom:2px solid #E5E7EB; }

    /* ── Table ── */
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:#3B82F6; color:white; padding:7px 5px; text-align:left; font-size:10px; }
    td { padding:6px 5px; border-bottom:1px solid #F3F4F6; vertical-align:top; }
    tr:nth-child(even) td { background:#F9FAFB; }

    /* ── Status badges ── */
    .status-normal  { color:#10B981; font-weight:600; font-size:9px; display:inline-block; background:#D1FAE5; padding:1px 4px; border-radius:3px; margin-left:3px; }
    .status-warning { color:#92400E; font-weight:600; font-size:9px; display:inline-block; background:#FEF3C7; padding:1px 4px; border-radius:3px; margin-left:3px; }
    .status-critical{ color:#991B1B; font-weight:600; font-size:9px; display:inline-block; background:#FEE2E2; padding:1px 4px; border-radius:3px; margin-left:3px; }
    .status-low     { color:#92400E; font-weight:600; font-size:9px; display:inline-block; background:#FEF3C7; padding:1px 4px; border-radius:3px; margin-left:3px; }
    .status-high    { color:#991B1B; font-weight:600; font-size:9px; display:inline-block; background:#FEE2E2; padding:1px 4px; border-radius:3px; margin-left:3px; }
    .status-na      { color:#9CA3AF; font-size:9px; margin-left:3px; }
    .unit { font-size:9px; color:#9CA3AF; }

    /* ── Disclaimer ── */
    .disclaimer {
      background:#FFF8E7;
      border:1px solid #FCD34D;
      border-left:4px solid #F59E0B;
      border-radius:8px;
      padding:12px 16px;
      margin-top:16px;
    }
    .disclaimer-title {
      font-size:12px;
      font-weight:700;
      color:#92400E;
      margin-bottom:6px;
      display:flex;
      align-items:center;
      gap:6px;
    }
    .disclaimer ul {
      margin:0;
      padding-left:16px;
    }
    .disclaimer ul li {
      color:#78350F;
      font-size:10px;
      line-height:1.8;
    }

    /* ── Footer ── */
    .footer { margin-top:16px; padding-top:10px; border-top:1px solid #E5E7EB; text-align:center; color:#9CA3AF; font-size:9px; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>📊 Meditrack Health Report</h1>
      <p>Detailed Vitals Monitoring &middot; Generated: ${currentDate} at ${currentTime}</p>
    </div>
    <span class="range-badge">📅 ${rangeLabel}</span>
  </div>

  <!-- Patient Info — column grid -->
  <div class="patient-section">
    <div class="patient-section-title">🧑‍⚕️ Patient Information</div>
    <div class="patient-grid">
      <div class="patient-cell">
        <div class="pi-label">Patient Name</div>
        <div class="pi-value">${patientName}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Patient ID</div>
        <div class="pi-value">${patientId}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Date of Birth</div>
        <div class="pi-value">${dob}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Gender</div>
        <div class="pi-value">${gender}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Blood Type</div>
        <div class="pi-value">${bloodType}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Phone</div>
        <div class="pi-value">${phone}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Email</div>
        <div class="pi-value">${email}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Report Period</div>
        <div class="pi-value">${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Data Points</div>
        <div class="pi-value">${history.length} readings</div>
      </div>
      <div class="patient-cell">
        <div class="pi-label">Address</div>
        <div class="pi-value">${address}</div>
      </div>
    </div>
  </div>

  <!-- Vitals Table -->
  <h2 class="section-title">🕐 ${isHourly ? "Hourly" : "Daily"} Vitals Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>${isHourly ? "Hour" : "Date"}</th>
        <th>Heart Rate</th>
        <th>SpO₂</th>
        <th>Temperature</th>
        <th>Steps</th>
        <th>Blood Pressure</th>
        <th>Blood Sugar</th>
        <th>BMI</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="8" style="text-align:center;color:#9CA3AF;padding:16px">No data available for this period</td></tr>`}
    </tbody>
  </table>

  <!-- Disclaimer — HTML formatted -->
  <div class="disclaimer">
    <div class="disclaimer-title">⚠️ Medical Disclaimer</div>
    <ul>
      <li>This report is generated automatically from wearable sensor data and is intended for <strong>informational purposes only</strong>.</li>
      <li>It does <strong>not constitute medical advice</strong>, diagnosis, or treatment recommendations.</li>
      <li>Readings may vary due to device calibration, user activity, or environmental factors.</li>
      <li>Always consult a <strong>qualified healthcare professional</strong> before making any medical decisions based on this data.</li>
      <li>In case of a medical emergency, contact your local emergency services immediately.</li>
    </ul>
  </div>

  <div class="footer">
    <p>© 2025 Meditrack Health Solutions &middot; Confidential Patient Data &middot; Generated: ${currentDate} at ${currentTime}</p>
  </div>
</body>
</html>`;
};

// ─── PDF Range Selector Modal ─────────────────────────────────────────────────
const PDF_RANGES = [
  { id: "24h", label: "Last 24 Hours", icon: "🕐", isHourly: true },
  { id: "1m", label: "Last 1 Month", icon: "🗓️", isHourly: false },
  { id: "custom", label: "Custom Range", icon: "✏️", isHourly: false },
];

function PdfRangeModal({ visible, onClose, onExport, isExporting }) {
  const [selected, setSelected] = useState("24h");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Auto-format date as YYYY-MM-DD
  const handleStartChange = (text) => {
    const formatted = formatDateInput(text, customStart);
    setCustomStart(formatted);
  };

  const handleEndChange = (text) => {
    const formatted = formatDateInput(text, customEnd);
    setCustomEnd(formatted);
  };

  const handleExport = () => {
    let startDate, endDate;
    const now = new Date();
    endDate = now;

    if (selected === "24h") {
      startDate = new Date(now - 24 * 60 * 60 * 1000);
    } else if (selected === "1m") {
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    } else {
      if (!customStart || !customEnd) {
        Alert.alert("Error", "Please enter both start and end dates.");
        return;
      }
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      if (isNaN(startDate) || isNaN(endDate)) {
        Alert.alert("Error", "Invalid date format. Use YYYY-MM-DD.");
        return;
      }
      if (startDate >= endDate) {
        Alert.alert("Error", "Start date must be before end date.");
        return;
      }
    }

    const rangeInfo = PDF_RANGES.find((r) => r.id === selected);
    const rangeLabel = selected === "custom"
      ? `${customStart} to ${customEnd}`
      : rangeInfo?.label || "Custom";
    onExport({ startDate, endDate, rangeLabel, isHourly: rangeInfo?.isHourly ?? false });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>📥 Export PDF Report</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.subtitle}>Select the time range for your report</Text>

          {PDF_RANGES.map((range) => (
            <TouchableOpacity
              key={range.id}
              style={[modalStyles.rangeOption, selected === range.id && modalStyles.rangeOptionActive]}
              onPress={() => setSelected(range.id)}
            >
              <Text style={modalStyles.rangeIcon}>{range.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[modalStyles.rangeLabel, selected === range.id && modalStyles.rangeLabelActive]}>
                  {range.label}
                </Text>
                {range.id === "24h" && <Text style={modalStyles.rangeHint}>Grouped by hour</Text>}
                {range.id === "1m" && <Text style={modalStyles.rangeHint}>Grouped by day</Text>}
                {range.id === "custom" && <Text style={modalStyles.rangeHint}>Grouped by day</Text>}
              </View>
              {selected === range.id && <View style={modalStyles.checkDot} />}
            </TouchableOpacity>
          ))}

          {selected === "custom" && (
            <View style={modalStyles.customInputs}>
              <Text style={modalStyles.customTitle}>Enter Date Range</Text>
              <View style={modalStyles.dateRow}>
                <View style={modalStyles.dateInputWrap}>
                  <Text style={modalStyles.dateLabel}>From</Text>
                  <TextInput
                    style={modalStyles.dateTextInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={customStart}
                    onChangeText={handleStartChange}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={modalStyles.dateInputWrap}>
                  <Text style={modalStyles.dateLabel}>To</Text>
                  <TextInput
                    style={modalStyles.dateTextInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={customEnd}
                    onChangeText={handleEndChange}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
              {customStart.length === 10 && customEnd.length === 10 && (
                <Text style={modalStyles.datePreview}>
                  📅 {new Date(customStart).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} → {new Date(customEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[modalStyles.exportBtn, isExporting && { opacity: 0.7 }]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Download size={18} color="#fff" />
                <Text style={modalStyles.exportBtnText}>Generate & Export PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  closeBtn: { padding: 4 },
  subtitle: { fontSize: 13, color: "#6B7280", marginBottom: 16 },
  rangeOption: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 10, backgroundColor: "#F9FAFB" },
  rangeOptionActive: { borderColor: "#3B82F6", backgroundColor: "#EFF6FF" },
  rangeIcon: { fontSize: 20, marginRight: 12 },
  rangeLabel: { fontSize: 15, color: "#374151", fontWeight: "500" },
  rangeLabelActive: { color: "#1D4ED8", fontWeight: "700" },
  rangeHint: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  checkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6" },
  customInputs: { backgroundColor: "#F8FAFF", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#DBEAFE" },
  customTitle: { fontSize: 13, fontWeight: "600", color: "#1D4ED8", marginBottom: 10 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateInputWrap: { flex: 1 },
  dateLabel: { fontSize: 11, color: "#6B7280", marginBottom: 4, fontWeight: "500" },
  dateTextInput: {
    borderWidth: 1.5,
    borderColor: "#3B82F6",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
    fontWeight: "600",
    letterSpacing: 1,
  },
  datePreview: { marginTop: 10, fontSize: 12, color: "#1D4ED8", fontWeight: "600", textAlign: "center" },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#10B981", paddingVertical: 15, borderRadius: 14, marginTop: 12 },
  exportBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HealthReport({ navigation }) {
  const [selectedPeriod, setSelectedPeriod] = useState("24hour");
  const [isExporting, setIsExporting] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [latestVitals, setLatestVitals] = useState(null);
  const [history24h, setHistory24h] = useState([]);
  const [history30d, setHistory30d] = useState([]);
  const [stats, setStats] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [hourlyVitals, setHourlyVitals] = useState([]);
  const [dailySummary, setDailySummary] = useState([]);
  const [insights, setInsights] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [latest, hist30d, st, profile] = await Promise.all([
        fetchLatestVitals().catch(() => null),
        fetchHistory(30).catch(() => []),
        fetchStats().catch(() => null),
        getProfile().catch(() => null),
      ]);

      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hist24h = hist30d.filter((r) => new Date(r.timestamp) >= cutoff24h);

      setLatestVitals(latest);
      setHistory24h(hist24h);
      setHistory30d(hist30d);
      setStats(st);
      setProfileData(profile);
      setHourlyVitals(buildHourlyVitals(hist24h));
      setDailySummary(buildDailySummary(hist30d));
      setInsights(buildInsights(hist30d, st));
    } catch (e) {
      console.error("❌ HealthReport load error:", e);
      Alert.alert("Error", "Failed to load health data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Latest vitals from backend ──
  const d = latestVitals || {};
  const hr = d.heartRate || 0;
  const spo2 = d.bloodOxygen || 0;
  const tempC = d.temperature || 0;
  const tempF = tempC ? celsiusToF(tempC) : 0;
  const bpSys = d.bloodPressureSystolic || 0;
  const bpDia = d.bloodPressureDiastolic || 0;
  const bloodSugar = d.bloodSugar || 0;
  const bmi = d.bmi || 0;
  const steps24 = history24h.reduce((s, r) => s + (r.footsteps || 0), 0);

  // ── 30d derived ──
  const avgHR30 = avg(history30d, "heartRate");
  const avgSpo2_30 = avg(history30d, "bloodOxygen");
  const avgTemp30C = avg(history30d, "temperature");
  const avgTemp30F = avgTemp30C ? celsiusToF(avgTemp30C) : 0;
  const totalSteps30 = history30d.reduce((s, r) => s + (r.footsteps || 0), 0);
  const avgBPSys30 = avg(history30d, "bloodPressureSystolic");
  const avgBS30 = avg(history30d, "bloodSugar");
  const avgBMI30 = avg(history30d, "bmi");
  const healthScore30 = calcHealthScore(history30d);
  const totalAlerts30 = history30d.filter((r) => r.alertLevel !== "normal").length;
  const normalPct30 = history30d.length
    ? ((history30d.filter((r) => r.alertLevel === "normal").length / history30d.length) * 100).toFixed(1)
    : "0";

  // Trend data for 24h charts
  const hrData = buildHourlyDataForVital(history24h, "heartRate");
  const spo2Data = buildHourlyDataForVital(history24h, "bloodOxygen");
  const tempData = buildHourlyDataForVital(history24h, "temperature");
  const bpData = buildHourlyDataForVital(history24h, "bloodPressureSystolic");
  const bsData = buildHourlyDataForVital(history24h, "bloodSugar");

  // Min/avg/max for 24h
  const hrVals24 = history24h.map((r) => r.heartRate || 0).filter((v) => v > 0);
  const spo2Vals24 = history24h.map((r) => r.bloodOxygen || 0).filter((v) => v > 0);

  // ── PDF Export ──
  const handleExport = async ({ startDate, endDate, rangeLabel, isHourly }) => {
    try {
      setIsExporting(true);
      setShowPdfModal(false);

      const history = await fetchHistoryByRange(startDate, endDate);
      const currentDate = new Date().toLocaleDateString();
      const currentTime = new Date().toLocaleTimeString();

      const htmlContent = buildPdfHtml({ profileData, rangeLabel, startDate, endDate, history, currentDate, currentTime, isHourly });

      const fileName = `Meditrack_Report_${rangeLabel.replace(/[\s→]/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}_${Date.now()}.html`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, htmlContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/html",
          dialogTitle: "Share Health Report",
          UTI: "public.html",
        });
        Alert.alert("✅ Report Exported!", `Your ${rangeLabel} health report has been exported.`);
      } else {
        Alert.alert("❌ Sharing Not Available", "Sharing is not available on this device.");
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("❌ Export Failed", "Failed to export the report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#E0E7FF" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Health Report</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={{ marginTop: 12, color: "#6B7280", fontSize: 15 }}>Loading health data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E0E7FF" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Report</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} tintColor="#3B82F6" />}
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === "24hour" && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod("24hour")}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === "24hour" && styles.periodButtonTextActive]}>
              Last 24 Hours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === "30days" && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod("30days")}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === "30days" && styles.periodButtonTextActive]}>
              Last 30 Days
            </Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════ 24 HOUR TAB ══════════════ */}
        {selectedPeriod === "24hour" && (
          <>
            {/* Export Button */}
            <View style={styles.exportContainer}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => setShowPdfModal(true)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Download size={20} color="#FFFFFF" />
                    <Text style={styles.exportButtonText}>Export PDF Report</Text>
                    <Share2 size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Hourly Vitals Table ── */}
            <View style={styles.hourlyCard}>
              <View style={styles.hourlyHeader}>
                <Clock size={18} color="#3B82F6" />
                <Text style={styles.hourlyTitle}>Hourly Vitals Breakdown</Text>
              </View>
              <Text style={styles.hourlySubtitle}>Real-time data from backend · Pull to refresh</Text>

              {hourlyVitals.length === 0 ? (
                <View style={styles.noDataBox}>
                  <Text style={styles.noDataText}>No data available for the last 24 hours</Text>
                </View>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { width: 70 }]}>Time</Text>
                        <Text style={[styles.tableHeaderCell, { width: 72 }]}>HR (bpm)</Text>
                        <Text style={[styles.tableHeaderCell, { width: 62 }]}>SpO₂ (%)</Text>
                        <Text style={[styles.tableHeaderCell, { width: 68 }]}>Temp (°F)</Text>
                        <Text style={[styles.tableHeaderCell, { width: 70 }]}>Steps</Text>
                        <Text style={[styles.tableHeaderCell, { width: 82 }]}>BP (mmHg)</Text>
                        <Text style={[styles.tableHeaderCell, { width: 80 }]}>Sugar (mg/dL)</Text>
                        <Text style={[styles.tableHeaderCell, { width: 52 }]}>BMI</Text>
                      </View>

                      {hourlyVitals.map((row, idx) => {
                        const hrStatus = row.heartRate ? getStatusForHR(row.heartRate) : "N/A";
                        const spo2Status = row.bloodOxygen ? getStatusForSpo2(row.bloodOxygen) : "N/A";
                        const tempStatus = row.temperature ? getStatusForTemp(row.temperature) : "N/A";
                        const bpStatus = row.bloodPressureSystolic ? getStatusForBP(row.bloodPressureSystolic) : "N/A";
                        const bsStatus = row.bloodSugar ? getStatusForBloodSugar(row.bloodSugar) : "N/A";
                        const bmiStatus = row.bmi ? getStatusForBMI(row.bmi) : "N/A";
                        const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB";

                        const hasCritical = [hrStatus, spo2Status, tempStatus, bpStatus, bsStatus].includes("Critical");
                        const hasWarning = [hrStatus, spo2Status, tempStatus, bpStatus, bsStatus, bmiStatus].some((s) =>
                          ["Warning", "High", "Low"].includes(s)
                        );
                        const leftBorderColor = hasCritical ? "#EF4444" : hasWarning ? "#F59E0B" : "#10B981";

                        return (
                          <View key={idx} style={[styles.tableRow, { backgroundColor: rowBg, borderLeftColor: leftBorderColor }]}>
                            <View style={{ width: 70 }}>
                              <Text style={styles.tableTimeText}>{formatHour(row.hour)}</Text>
                              <Text style={styles.tableCountText}>{row.count} rdg</Text>
                            </View>
                            <View style={{ width: 72 }}>
                              <Text style={styles.tableValueText}>{row.heartRate || "—"}</Text>
                              <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(hrStatus) }]}>
                                <Text style={[styles.miniStatusText, { color: statusColor(hrStatus) }]}>{hrStatus}</Text>
                              </View>
                            </View>
                            <View style={{ width: 62 }}>
                              <Text style={styles.tableValueText}>{row.bloodOxygen || "—"}</Text>
                              <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(spo2Status) }]}>
                                <Text style={[styles.miniStatusText, { color: statusColor(spo2Status) }]}>{spo2Status}</Text>
                              </View>
                            </View>
                            <View style={{ width: 68 }}>
                              <Text style={styles.tableValueText}>{row.temperature ? celsiusToF(row.temperature) : "—"}</Text>
                              <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(tempStatus) }]}>
                                <Text style={[styles.miniStatusText, { color: statusColor(tempStatus) }]}>{tempStatus}</Text>
                              </View>
                            </View>
                            <View style={{ width: 70 }}>
                              <Text style={styles.tableValueText}>{row.footsteps?.toLocaleString() || "—"}</Text>
                            </View>
                            <View style={{ width: 82 }}>
                              <Text style={styles.tableValueText}>
                                {row.bloodPressureSystolic && row.bloodPressureDiastolic
                                  ? `${row.bloodPressureSystolic}/${row.bloodPressureDiastolic}`
                                  : "—"}
                              </Text>
                              {row.bloodPressureSystolic ? (
                                <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(bpStatus) }]}>
                                  <Text style={[styles.miniStatusText, { color: statusColor(bpStatus) }]}>{bpStatus}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={{ width: 80 }}>
                              <Text style={styles.tableValueText}>{row.bloodSugar || "—"}</Text>
                              {row.bloodSugar ? (
                                <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(bsStatus) }]}>
                                  <Text style={[styles.miniStatusText, { color: statusColor(bsStatus) }]}>{bsStatus}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={{ width: 52 }}>
                              <Text style={styles.tableValueText}>{row.bmi || "—"}</Text>
                              {row.bmi ? (
                                <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(bmiStatus) }]}>
                                  <Text style={[styles.miniStatusText, { color: statusColor(bmiStatus) }]}>{bmiStatus}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <View style={styles.legendRow}>
                    {[
                      { color: "#10B981", label: "Normal" },
                      { color: "#F59E0B", label: "Warning" },
                      { color: "#EF4444", label: "Critical" },
                    ].map((l) => (
                      <View key={l.label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                        <Text style={styles.legendText}>{l.label}</Text>
                      </View>
                    ))}
                    <Text style={styles.legendNote}>← Left border</Text>
                  </View>
                </>
              )}
            </View>

            {/* ── Multi-Vital Hourly Trends ── */}
            <View style={styles.trendsCard}>
              <Text style={styles.trendsTitle}>Hourly Trends (24h)</Text>
              <Text style={styles.trendsSubtitle}>Real-time data from backend</Text>

              {[
                { label: "Heart Rate", data: hrData, color: "#EF4444", unit: "bpm", vals: hrVals24, getStatus: getStatusForHR, currentVal: hr, histKey: "heartRate" },
                { label: "Blood Oxygen (SpO₂)", data: spo2Data, color: "#3B82F6", unit: "%", vals: spo2Vals24, getStatus: getStatusForSpo2, currentVal: spo2, histKey: "bloodOxygen" },
                { label: "Temperature", data: tempData, color: "#F59E0B", unit: "°C", vals: history24h.map((r) => r.temperature || 0).filter((v) => v > 0), getStatus: getStatusForTemp, currentVal: tempC, histKey: "temperature" },
                { label: "Blood Pressure (Systolic)", data: bpData, color: "#8B5CF6", unit: "mmHg", vals: history24h.map((r) => r.bloodPressureSystolic || 0).filter((v) => v > 0), getStatus: getStatusForBP, currentVal: bpSys, histKey: "bloodPressureSystolic" },
                { label: "Blood Sugar", data: bsData, color: "#10B981", unit: "mg/dL", vals: history24h.map((r) => r.bloodSugar || 0).filter((v) => v > 0), getStatus: getStatusForBloodSugar, currentVal: bloodSugar, histKey: "bloodSugar" },
              ].map((vital, vi) => (
                <View key={vi} style={styles.vitalTrendBlock}>
                  <View style={styles.trendRow}>
                    <Text style={styles.trendLabel}>{vital.label}</Text>
                    {vital.currentVal > 0 && (
                      <View style={[styles.trendStatusBadge, { backgroundColor: statusBg(vital.getStatus(vital.currentVal)) }]}>
                        <Text style={[styles.trendStatusText, { color: statusColor(vital.getStatus(vital.currentVal)) }]}>
                          {vital.getStatus(vital.currentVal)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <MiniBarChart data={vital.data} color={vital.color} />
                  {vital.vals.length > 0 && (
                    <View style={styles.hrRangeRow}>
                      <Text style={styles.hrRangeLabel}>Min: <Text style={styles.hrRangeVal}>{Math.min(...vital.vals).toFixed(1)} {vital.unit}</Text></Text>
                      <Text style={styles.hrRangeLabel}>Avg: <Text style={styles.hrRangeVal}>{avg(history24h, vital.histKey)} {vital.unit}</Text></Text>
                      <Text style={styles.hrRangeLabel}>Max: <Text style={styles.hrRangeVal}>{Math.max(...vital.vals).toFixed(1)} {vital.unit}</Text></Text>
                    </View>
                  )}
                  {vi < 4 && <View style={styles.vitalTrendDivider} />}
                </View>
              ))}
            </View>

            {/* ── Today's Health Summary (below charts) ── */}
            <VitalHealthSummary history24h={history24h} latestVitals={latestVitals} />
          </>
        )}

        {/* ══════════════ 30 DAYS TAB ══════════════ */}
        {selectedPeriod === "30days" && (
          <>
            {/* Vitals at a Glance — replaces 30-day averages grid */}
            <VitalHighlightsCard
              history30d={history30d}
              stats={stats}
              latestVitals={latestVitals}
            />

            {/* 30-Day Timeline Chart */}
            <HealthTimeline dailySummary={dailySummary} />

            {/* Daily Breakdown Table — real-time from backend */}
            <View style={styles.monthlyCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={styles.monthlyTitle}>Daily Breakdown (30 Days)</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#10B981" }}>Live</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[styles.tableHeader, { borderRadius: 8 }]}>
                    {["Date", "HR", "SpO₂", "Temp°F", "BP Sys", "Sugar", "BMI", "Steps"].map((h) => (
                      <Text key={h} style={[styles.tableHeaderCell, { width: h === "Date" ? 80 : 64 }]}>{h}</Text>
                    ))}
                  </View>
                  {dailySummary.length === 0 ? (
                    <Text style={{ color: "#6B7280", textAlign: "center", paddingVertical: 16, paddingHorizontal: 20 }}>No data available</Text>
                  ) : (
                    dailySummary.map((day, i) => {
                      const hrSt = day.heartRate ? getStatusForHR(day.heartRate) : "N/A";
                      const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
                      return (
                        <View key={i} style={[styles.tableRow, { backgroundColor: rowBg, borderLeftColor: statusColor(hrSt) }]}>
                          <Text style={[styles.tableTimeText, { width: 80 }]}>{day.date}</Text>
                          <View style={{ width: 64 }}>
                            <Text style={styles.tableValueText}>{day.heartRate || "—"}</Text>
                            {day.heartRate ? <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(hrSt) }]}><Text style={[styles.miniStatusText, { color: statusColor(hrSt) }]}>{hrSt}</Text></View> : null}
                          </View>
                          <Text style={[styles.tableValueText, { width: 64 }]}>{day.bloodOxygen || "—"}</Text>
                          <Text style={[styles.tableValueText, { width: 64 }]}>{day.temperature ? celsiusToF(day.temperature) : "—"}</Text>
                          <Text style={[styles.tableValueText, { width: 64 }]}>{day.bloodPressureSystolic || "—"}</Text>
                          <Text style={[styles.tableValueText, { width: 64 }]}>{day.bloodSugar || "—"}</Text>
                          <Text style={[styles.tableValueText, { width: 64 }]}>{day.bmi || "—"}</Text>
                          <Text style={[styles.tableValueText, { width: 64 }]}>{day.footsteps?.toLocaleString() || "—"}</Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>

            {/* Key Insights */}
            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>Key Insights</Text>
              <Text style={styles.insightsSubtitle}>Based on your last 30 days of backend data</Text>
              {insights.length === 0 ? (
                <Text style={{ color: "#6B7280", textAlign: "center", paddingVertical: 12 }}>Not enough data for insights</Text>
              ) : (
                insights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <View key={item.id} style={[styles.insightItem, { backgroundColor: item.bgColor }]}>
                      <View style={[styles.insightIconContainer, { backgroundColor: item.color + "30" }]}>
                        <Icon size={18} color={item.color} />
                      </View>
                      <Text style={styles.insightText}>{item.text}</Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Stats Grid — real-time */}
            <View style={styles.statsCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Text style={styles.monthlyTitle}>30-Day Statistics</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#3B82F6" }} />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#3B82F6" }}>Real-time</Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{dailySummary.length}</Text>
                  <Text style={styles.statLabel}>Days Tracked</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{normalPct30}%</Text>
                  <Text style={styles.statLabel}>Normal Readings</Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{totalAlerts30}</Text>
                  <Text style={styles.statLabel}>Total Alerts</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{history30d.length}</Text>
                  <Text style={styles.statLabel}>Data Points</Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{totalSteps30.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Total Steps</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats?.avgRiskScore ? `${stats.avgRiskScore}%` : "N/A"}</Text>
                  <Text style={styles.statLabel}>Avg Risk Score</Text>
                </View>
              </View>
            </View>

            {/* Overall Health Card — real-time */}
            <View style={styles.overallHealthCard}>
              <View style={styles.overallHeader}>
                <View style={styles.overallInfo}>
                  <Text style={styles.overallTitle}>Overall Health Status</Text>
                  <Text style={styles.overallSubtitle}>Live backend data · {history30d.length} readings</Text>
                </View>
                <View style={[styles.gradeCircle, { backgroundColor: healthScore30 >= 80 ? "#10B981" : healthScore30 >= 60 ? "#F59E0B" : "#EF4444" }]}>
                  <Text style={styles.gradeText}>
                    {healthScore30 >= 90 ? "A+" : healthScore30 >= 80 ? "A" : healthScore30 >= 70 ? "B" : "C"}
                  </Text>
                  <Text style={styles.gradeLabel}>
                    {healthScore30 >= 90 ? "Excellent" : healthScore30 >= 75 ? "Good" : "Fair"}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreBarContainer}>
                <View style={styles.scoreBarBg}>
                  <View style={[styles.scoreBarFill, {
                    width: `${healthScore30}%`,
                    backgroundColor: healthScore30 >= 80 ? "#10B981" : healthScore30 >= 60 ? "#F59E0B" : "#EF4444"
                  }]} />
                </View>
                <Text style={styles.scoreBarText}>{healthScore30}/100</Text>
              </View>

              <Text style={styles.overallDescription}>
                {healthScore30 >= 90
                  ? "Your health data shows consistently excellent performance over the last 30 days. Keep up the great habits!"
                  : healthScore30 >= 75
                  ? "Your health data looks good overall. A few alerts detected — keep monitoring your vitals regularly."
                  : "Some irregular readings detected over the last 30 days. Consider consulting your healthcare provider."}
              </Text>

              <View style={styles.overallStatsRow}>
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatVal}>{history30d.length}</Text>
                  <Text style={styles.overallStatLbl}>Readings</Text>
                </View>
                <View style={styles.overallStatDiv} />
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatVal}>{totalAlerts30}</Text>
                  <Text style={styles.overallStatLbl}>Alerts</Text>
                </View>
                <View style={styles.overallStatDiv} />
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatVal}>{normalPct30}%</Text>
                  <Text style={styles.overallStatLbl}>Normal</Text>
                </View>
                <View style={styles.overallStatDiv} />
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatVal}>{dailySummary.length}</Text>
                  <Text style={styles.overallStatLbl}>Days</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* PDF Range Modal */}
      <PdfRangeModal
        visible={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <Footer />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E0E7FF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#E0E7FF" },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },

  periodSelector: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16, marginBottom: 16 },
  periodButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  periodButtonActive: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  periodButtonText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  periodButtonTextActive: { color: "#FFFFFF" },

  exportContainer: { paddingHorizontal: 16, marginBottom: 16 },
  exportButton: { backgroundColor: "#10B981", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, gap: 8, elevation: 4 },
  exportButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },

  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  summaryTitle: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  asOfText: { fontSize: 12, color: "#6B7280" },

  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  vitalBox: { width: "47%", backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, alignItems: "center" },
  vitalIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  vitalLabel: { fontSize: 12, color: "#6B7280", marginBottom: 2, textAlign: "center" },
  vitalValue: { fontSize: 14, fontWeight: "bold", color: "#111827", textAlign: "center" },

  // Hourly vitals table
  hourlyCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  hourlyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  hourlyTitle: { fontSize: 17, fontWeight: "bold", color: "#111827" },
  hourlySubtitle: { fontSize: 11, color: "#9CA3AF", marginBottom: 12 },
  noDataBox: { paddingVertical: 24, alignItems: "center" },
  noDataText: { color: "#9CA3AF", fontSize: 14, textAlign: "center" },
  tableHeader: { flexDirection: "row", backgroundColor: "#3B82F6", paddingVertical: 9, paddingHorizontal: 10, marginBottom: 3 },
  tableHeaderCell: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, marginBottom: 2, borderLeftWidth: 4 },
  tableTimeText: { fontSize: 12, fontWeight: "600", color: "#111827" },
  tableCountText: { fontSize: 10, color: "#9CA3AF", marginTop: 1 },
  tableValueText: { fontSize: 13, fontWeight: "700", color: "#111827" },
  tableUnitText: { fontSize: 10, color: "#9CA3AF" },
  miniStatusBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2, alignSelf: "flex-start" },
  miniStatusText: { fontSize: 8, fontWeight: "700" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6", flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#6B7280" },
  legendNote: { fontSize: 10, color: "#9CA3AF", fontStyle: "italic" },

  // Trends card
  trendsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  trendsTitle: { fontSize: 17, fontWeight: "bold", color: "#111827", marginBottom: 2 },
  trendsSubtitle: { fontSize: 11, color: "#9CA3AF", marginBottom: 12 },
  vitalTrendBlock: { marginBottom: 4 },
  vitalTrendDivider: { height: 1, backgroundColor: "#F3F4F6", marginTop: 12, marginBottom: 12 },
  trendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trendLabel: { fontSize: 13, color: "#374151", fontWeight: "600" },
  trendStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  trendStatusText: { fontSize: 11, fontWeight: "700" },
  hrRangeRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#F9FAFB" },
  hrRangeLabel: { fontSize: 11, color: "#6B7280" },
  hrRangeVal: { fontWeight: "700", color: "#111827" },

  // Monthly card
  monthlyCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  monthlyTitle: { fontSize: 17, fontWeight: "bold", color: "#111827" },

  // Insights
  insightsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  insightsTitle: { fontSize: 17, fontWeight: "bold", color: "#111827", marginBottom: 2 },
  insightsSubtitle: { fontSize: 11, color: "#9CA3AF", marginBottom: 12 },
  insightItem: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 10 },
  insightIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 12 },
  insightText: { flex: 1, fontSize: 13, color: "#111827", lineHeight: 18 },

  // Stats
  statsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  statsGrid: { flexDirection: "row", justifyContent: "space-around", marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 2 },

  // Overall health
  overallHealthCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 16, elevation: 2 },
  overallHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  overallInfo: { flex: 1 },
  overallTitle: { fontSize: 17, fontWeight: "bold", color: "#111827" },
  overallSubtitle: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  gradeCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  gradeText: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF" },
  gradeLabel: { fontSize: 9, color: "rgba(255,255,255,0.9)" },
  scoreBarContainer: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  scoreBarBg: { flex: 1, height: 10, backgroundColor: "#E5E7EB", borderRadius: 5, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 5 },
  scoreBarText: { fontSize: 13, fontWeight: "700", color: "#111827", minWidth: 50, textAlign: "right" },
  overallDescription: { fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 14 },
  overallStatsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12 },
  overallStat: { alignItems: "center" },
  overallStatVal: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  overallStatLbl: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  overallStatDiv: { width: 1, height: 28, backgroundColor: "#E5E7EB" },
});
