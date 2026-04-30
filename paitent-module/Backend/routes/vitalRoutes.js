const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');

const Hypertension           = require('../models/Hypertension');
const HeartCondition         = require('../models/HeartCondition');
const VitalReading           = require('../models/VitalReadings');
const SleepApnea             = require('../models/SleepApnea');
const TachycardiaBradycardia = require('../models/TachycardiaBradycardia');
const EmergencyContact       = require('../models/EmergencyContact');
const User                   = require('../models/User');

const mongoose = require('mongoose');
const Guardian = mongoose.models.Guardian || require('mongoose').model('Guardian', new mongoose.Schema({
  name:          String,
  email:         String,
  phone:         String,
  patientId:     mongoose.Schema.Types.ObjectId,
  expoPushToken: String,
  relation:      String,
  isVerified:    Boolean,
}, { timestamps: true }));

const { processHypertension } = require('../services/hypertensionService');
const { processSleepApnea }   = require('../services/sleepApneaService');
const { processTachyBrady }   = require('../services/tachyBradyService');

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// 🌡️ Temperature Sanitizer Helper
// Health Connect se kabhi kabhi room temp (18-25°C) aa jati hai
// Ya Fahrenheit value aa jati hai (98.6°F)
// Ye function ensure karta hai ke sirf valid body temp (35-42°C) save ho
// ─────────────────────────────────────────────────────────────────────────────
const sanitizeTemperature = (rawTemp) => {
  if (!rawTemp || isNaN(rawTemp)) return 37.0;

  const temp = parseFloat(rawTemp);

  // Agar Fahrenheit mein hai (e.g. 98.6) — Celsius convert karo
  if (temp > 42 && temp < 110) {
    const celsius = parseFloat(((temp - 32) * 5 / 9).toFixed(1));
    // Converted value valid hai?
    if (celsius >= 35 && celsius <= 42) return celsius;
  }

  // Already Celsius mein hai aur valid range mein hai
  if (temp >= 35 && temp <= 42) return temp;

  // Koi bhi valid value nahi mili — default use karo
  console.warn(`⚠️ Invalid temperature received: ${rawTemp} — using default 37.0`);
  return 37.0;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔔 Guardian Notification Helper
// ─────────────────────────────────────────────────────────────────────────────
const sendGuardianNotification = async (userId, title, body) => {
  try {
    const guardians = await Guardian.find({ patientId: userId, isVerified: true });
    if (!guardians.length) return;

    const messages = [];
    for (const guardian of guardians) {
      if (guardian.expoPushToken) {
        messages.push({
          to:    guardian.expoPushToken,
          sound: 'default',
          title,
          body,
          data: { userId: userId.toString(), type: 'vital_alert' },
        });
      }
    }

    if (!messages.length) return;

    await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 5000,
    });
  } catch (err) {
    console.error('❌ Guardian notification error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🩺 Vital Alert Check
// ─────────────────────────────────────────────────────────────────────────────
const checkAndNotifyVitals = async (userId, reading) => {
  const alerts = [];

  if (reading.heartRate > 100)
    alerts.push({ title: '❤️ Heart Rate High', body: `Heart rate ${reading.heartRate} bpm — normal 60-100` });
  else if (reading.heartRate < 60)
    alerts.push({ title: '❤️ Heart Rate Low', body: `Heart rate ${reading.heartRate} bpm — normal 60-100` });

  if (reading.bloodOxygen < 95)
    alerts.push({ title: '💨 Oxygen Low', body: `SpO2 ${reading.bloodOxygen}% — should be above 95%` });

  if (reading.systolicBP && reading.systolicBP > 140)
    alerts.push({ title: '🩸 BP High', body: `BP ${reading.systolicBP}/${reading.diastolicBP} mmHg` });
  else if (reading.systolicBP && reading.systolicBP < 90)
    alerts.push({ title: '🩸 BP Low', body: `BP ${reading.systolicBP}/${reading.diastolicBP} mmHg` });

  if (reading.bloodSugar && reading.bloodSugar > 180)
    alerts.push({ title: '🩸 Sugar High', body: `Blood sugar ${reading.bloodSugar} mg/dL` });
  else if (reading.bloodSugar && reading.bloodSugar < 70)
    alerts.push({ title: '🩸 Sugar Low', body: `Blood sugar ${reading.bloodSugar} mg/dL` });

  const moderateSeverities = ['Moderate', 'Severe', 'Critical'];
  if (moderateSeverities.includes(reading.severity)) {
    alerts.push({
      title: '🚨 Health Alert',
      body:  `Patient condition is ${reading.severity} — ${reading.condition}`,
    });
  }

  for (const alert of alerts) {
    await sendGuardianNotification(userId, alert.title, alert.body);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ ML Prediction Helper
// ─────────────────────────────────────────────────────────────────────────────
const getMLPrediction = async (endpoint, payload) => {
  try {
    const response = await axios.post(`${ML_SERVER_URL}${endpoint}`, payload, { timeout: 8000 });
    return response.data;
  } catch (err) {
    console.warn(`⚠️ ML prediction skipped (${endpoint}):`, err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vitals/record — Watch se aane wala data
// ─────────────────────────────────────────────────────────────────────────────
router.post('/record', auth, async (req, res) => {
  try {
    const {
      heartRate, bloodOxygen, temperature, footsteps,
      restingHeartRate, bmi, accelerometer, age, gender,
      systolicBP, diastolicBP, bloodSugar, respiratoryRate,
    } = req.body;

    const hr   = heartRate;
    const spo2 = bloodOxygen;

    if (!hr || !spo2) {
      return res.status(400).json({
        success: false,
        message: 'heartRate aur bloodOxygen required hain',
      });
    }

    // ✅ FIX: Temperature 3 jagah se try karo — priority order mein:
    // 1. Request body se (agar valid ho)
    // 2. User profile se (agar wahan ho)
    // 3. Default 37.0

    let finalTemperature = 37.0;

    // Step 1: Body se aayi temperature check karo
    if (temperature) {
      const sanitized = sanitizeTemperature(temperature);
      if (sanitized !== 37.0 || (temperature >= 35 && temperature <= 42)) {
        finalTemperature = sanitized;
      }
    }

    // Step 2: Agar body se valid nahi mili — profile se lo
    if (finalTemperature === 37.0) {
      try {
        const user = await User.findById(req.user.id).select('vitals');
        if (user?.vitals?.temperature) {
          const profileTemp = sanitizeTemperature(user.vitals.temperature);
          if (profileTemp >= 35 && profileTemp <= 42) {
            finalTemperature = profileTemp;
          }
        }
      } catch (e) {
        console.warn('⚠️ Profile temperature fetch failed, using default 37.0');
      }
    }

    console.log(`🌡️ Temperature used: ${finalTemperature}°C (raw input: ${temperature})`);

    const reading = new VitalReading({
      userId:           req.user.id,
      timestamp:        new Date(),
      heartRate:        hr,
      bloodOxygen:      spo2,
      temperature:      finalTemperature,   // ✅ sanitized & validated
      age:              age             ?? null,
      gender:           gender          ?? null,
      systolicBP:       systolicBP      ?? null,
      diastolicBP:      diastolicBP     ?? null,
      bloodSugar:       bloodSugar      ?? null,
      respiratoryRate:  respiratoryRate ?? null,
      footsteps:        footsteps       ?? 0,
      restingHeartRate: restingHeartRate ?? null,
      bmi:              bmi             ?? null,
      accelerometer:    accelerometer   ?? { x: 0, y: 0, z: 0, intensity: 'Still' },
    });

    await reading.save();
    await checkAndNotifyVitals(req.user.id, reading);

    res.status(201).json({
      success: true,
      message: 'Vitals saved successfully',
      data: {
        id:               reading._id,
        heartRate:        reading.heartRate,
        bloodOxygen:      reading.bloodOxygen,
        temperature:      reading.temperature,
        footsteps:        reading.footsteps,
        restingHeartRate: reading.restingHeartRate,
        bmi:              reading.bmi,
        accelerometer:    reading.accelerometer,
        condition:        reading.condition,
        riskScore:        reading.riskScore,
        severity:         reading.severity,
        alertLevel:       reading.alertLevel,
        timestamp:        reading.timestamp,
      },
    });

  } catch (error) {
    console.error('❌ Error recording vitals:', error);
    res.status(500).json({ success: false, message: 'Failed to record vital signs', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vitals/latest
// ─────────────────────────────────────────────────────────────────────────────
router.get('/latest', auth, async (req, res) => {
  try {
    const latest = await VitalReading.findOne({ userId: req.user.id }).sort({ timestamp: -1 });

    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: 'No vitals recorded yet',
      });
    }

    res.json({ success: true, data: latest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch latest vitals' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vitals/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const { startDate, endDate, limit = 1000 } = req.query;
    const query = { userId: req.user.id };
    if (startDate && endDate) {
      query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const readings = await VitalReading.find(query).sort({ timestamp: -1 }).limit(parseInt(limit));
    res.json({ success: true, count: readings.length, data: readings });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vitals/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const readings = await VitalReading.find({
      userId: req.user.id,
      timestamp: { $gte: sevenDaysAgo }
    }).sort({ timestamp: -1 });

    if (readings.length === 0)
      return res.json({ success: true, message: 'No data found', stats: null });

    const avg = (field) =>
      parseFloat((readings.reduce((s, r) => s + (r[field] || 0), 0) / readings.length).toFixed(2));

    const conditionCount = readings.reduce((acc, r) => {
      acc[r.condition] = (acc[r.condition] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      stats: {
        totalReadings:      readings.length,
        avgHeartRate:       avg('heartRate'),
        avgBloodOxygen:     avg('bloodOxygen'),
        avgTemperature:     avg('temperature'),
        avgRiskScore:       avg('riskScore'),
        totalSteps:         readings.reduce((s, r) => s + (r.footsteps || 0), 0),
        conditionBreakdown: conditionCount,
        alerts: {
          critical: readings.filter((r) => r.alertLevel === 'critical').length,
          warning:  readings.filter((r) => r.alertLevel === 'warning').length,
          normal:   readings.filter((r) => r.alertLevel === 'normal').length,
        },
        latestReading: readings[0],
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vitals/patient/:patient_id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/patient/:patient_id', auth, async (req, res) => {
  try {
    const { patient_id } = req.params;
    const [hypertension, sleepApnea, tachyBrady] = await Promise.all([
      Hypertension.find({ patient_id }).sort({ timestamp: -1 }).limit(10),
      SleepApnea.find({ patient_id }).sort({ timestamp: -1 }).limit(10),
      TachycardiaBradycardia.find({ patient_id }).sort({ timestamp: -1 }).limit(10),
    ]);
    res.json({ success: true, patient_id, data: { hypertension, sleepApnea, tachyBrady } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vitals/manual
// ─────────────────────────────────────────────────────────────────────────────
router.post('/manual', auth, async (req, res) => {
  try {
    const { systolicBP, diastolicBP, bloodSugar, temperature } = req.body;

    // ✅ FIX: Manual entry mein bhi temperature sanitize karo
    const safeTemp = temperature ? sanitizeTemperature(temperature) : null;

    const latest = await VitalReading.findOne({ userId: req.user.id }).sort({ timestamp: -1 });

    if (latest) {
      if (systolicBP)  latest.systolicBP  = systolicBP;
      if (diastolicBP) latest.diastolicBP = diastolicBP;
      if (bloodSugar)  latest.bloodSugar  = bloodSugar;
      if (safeTemp)    latest.temperature = safeTemp;
      await latest.save();
      await checkAndNotifyVitals(req.user.id, latest);
      return res.json({ success: true, message: 'Vitals updated', data: latest });
    }

    const reading = new VitalReading({
      userId:      req.user.id,
      systolicBP:  systolicBP  || null,
      diastolicBP: diastolicBP || null,
      bloodSugar:  bloodSugar  || null,
      temperature: safeTemp    || 37.0,
      heartRate:   70,
      bloodOxygen: 98,
      timestamp:   new Date(),
    });
    await reading.save();
    await checkAndNotifyVitals(req.user.id, reading);

    res.json({ success: true, message: 'Vitals saved', data: reading });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vitals/hypertension
// ─────────────────────────────────────────────────────────────────────────────
router.post('/hypertension', auth, async (req, res) => {
  try {
    const derived = processHypertension(req.body);
    const stepsArray = req.body.steps_7days || [0,0,0,0,0,0,0];
    const mlPayload = {
      Age:                      req.body.age,
      Gender:                   req.body.gender,
      Height_cm:                req.body.height_cm,
      Weight_kg:                req.body.weight_kg,
      BMI:                      derived.bmi,
      Resting_HR:               req.body.resting_hr,
      Steps_Day1:               stepsArray[0] || 0,
      Steps_Day2:               stepsArray[1] || 0,
      Steps_Day3:               stepsArray[2] || 0,
      Steps_Day4:               stepsArray[3] || 0,
      Steps_Day5:               stepsArray[4] || 0,
      Steps_Day6:               stepsArray[5] || 0,
      Steps_Day7:               stepsArray[6] || 0,
      Steps_7day_avg:           derived.steps_7day_avg,
      Steps_Score:              derived.steps_score,
      Systolic_BP:              req.body.systolic_bp,
      Diastolic_BP:             req.body.diastolic_bp,
      Pulse_Pressure:           derived.pulse_pressure,
      MAP:                      derived.map_mmhg,
      HRR_Proxy:                derived.hrr_proxy,
      Hypertension_Risk_Score:  derived.risk_score,
      model:                    'rf',
    };

    const mlResult = await getMLPrediction('/predict/hypertension', mlPayload);

    const record = new Hypertension({
      patient_id:   req.user.id,
      age:          req.body.age,
      gender:       req.body.gender,
      weight_kg:    req.body.weight_kg,
      height_cm:    req.body.height_cm,
      systolic_bp:  req.body.systolic_bp,
      diastolic_bp: req.body.diastolic_bp,
      resting_hr:   req.body.resting_hr,
      steps_7days:  stepsArray,
      ...derived,
      ml_prediction:    mlResult?.severity           || null,
      ml_confidence:    mlResult?.confidence_percent || null,
      ml_probabilities: mlResult?.probabilities      || null,
    });
    await record.save();

    const finalSeverity = mlResult?.severity || derived.severity;
    if (['Moderate', 'Severe', 'Critical'].includes(finalSeverity)) {
      await sendGuardianNotification(
        req.user.id,
        '🚨 Hypertension Alert',
        `ML Model ne ${finalSeverity} Hypertension detect ki — BP ${req.body.systolic_bp}/${req.body.diastolic_bp} mmHg`
      );
    }

    res.status(201).json({ success: true, message: '✅ Hypertension data saved', data: record, ml_result: mlResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vitals/sleep-apnea
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sleep-apnea', auth, async (req, res) => {
  try {
    const derived = processSleepApnea(req.body);
    const hr = req.body.heart_rate;
    const mlPayload = {
      Age:              req.body.age,
      Gender:           req.body.gender,
      Sleep_Hours:      req.body.sleep_duration_hours || 7,
      SpO2:             req.body.spo2,
      HR:               hr,
      Accel:            req.body.accel || 0.02,
      SpO2_Baseline:    req.body.spo2 + (req.body.spo2_drop || 0),
      SpO2_Drop:        req.body.spo2_drop || 0,
      HR_Variability:   5.0,
      HR_Pattern:       hr > 100 ? 'spike' : hr > 85 ? 'fluctuating' : 'steady',
      Accel_Type:       (req.body.accel || 0) > 0.1 ? 'jerk' : (req.body.accel || 0) > 0.03 ? 'restless' : 'still',
      SpO2_Score:       derived.spo2_score,
      HR_Score:         derived.hr_score,
      Accel_Score:      derived.accel_score,
      Age_Gender_Score: derived.age_gender_score,
      Risk_Multiplier:  derived.risk_multiplier,
      Physio_Score:     derived.physio_score,
      Event_Score:      derived.event_score,
      Events_L1:        derived.event_label === 1 ? 1 : 0,
      Events_L2:        derived.event_label === 2 ? 1 : 0,
      Total_Events:     derived.event_label,
      AHI_Score:        req.body.ahi || derived.event_score / 3,
      AHI_Threshold:    derived.ahi_threshold,
      model:            'rf',
    };

    const mlResult = await getMLPrediction('/predict/sleep-apnea', mlPayload);

    const record = new SleepApnea({
      patient_id:           req.user.id,
      age:                  req.body.age,
      gender:               req.body.gender,
      spo2:                 req.body.spo2,
      spo2_drop:            req.body.spo2_drop,
      heart_rate:           req.body.heart_rate,
      hr_spike:             req.body.hr_spike,
      accel:                req.body.accel,
      sleep_duration_hours: req.body.sleep_duration_hours,
      time_in_bed_hours:    req.body.time_in_bed_hours,
      ahi:                  req.body.ahi,
      ...derived,
      ml_prediction:    mlResult?.severity           || null,
      ml_confidence:    mlResult?.confidence_percent || null,
      ml_probabilities: mlResult?.probabilities      || null,
    });
    await record.save();

    const finalSeverity = mlResult?.severity || derived.severity;
    if (['Moderate', 'Severe', 'Critical'].includes(finalSeverity)) {
      await sendGuardianNotification(
        req.user.id,
        '🚨 Sleep Apnea Alert',
        `ML Model ne ${finalSeverity} Sleep Apnea detect ki — SpO2 ${req.body.spo2}%, HR ${req.body.heart_rate} bpm`
      );
    }

    res.status(201).json({ success: true, message: '✅ Sleep Apnea data saved', data: record, ml_result: mlResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vitals/tachy-brady
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tachy-brady', auth, async (req, res) => {
  try {
    const derived = processTachyBrady(req.body);
    const mlPayload = {
      Age:               req.body.age,
      Gender:            req.body.gender,
      HR:                req.body.heart_rate,
      SpO2:              req.body.spo2,
      Body_Temp:         37.0,
      Systolic_BP:       req.body.systolic_bp,
      Diastolic_BP:      req.body.diastolic_bp,
      Blood_Sugar:       100,
      Respiratory_Rate:  16,
      Pulse_Pressure:    derived.pulse_pressure,
      MAP:               derived.map_mmhg,
      Max_HR:            derived.max_hr,
      HRR:               derived.hrr,
      Shock_Index:       derived.shock_index,
      RPP:               derived.rpp,
      SpO2_Deficit:      derived.spo2_deficit,
      Condition:         derived.hr_condition,
      Risk_Score:        derived.risk_score,
      model:             'rf',
    };

    const mlResult = await getMLPrediction('/predict/heart', mlPayload);

    const record = new TachycardiaBradycardia({
      patient_id:   req.user.id,
      age:          req.body.age,
      gender:       req.body.gender,
      heart_rate:   req.body.heart_rate,
      systolic_bp:  req.body.systolic_bp,
      diastolic_bp: req.body.diastolic_bp,
      spo2:         req.body.spo2,
      ...derived,
      ml_prediction:    mlResult?.severity           || null,
      ml_confidence:    mlResult?.confidence_percent || null,
      ml_probabilities: mlResult?.probabilities      || null,
    });
    await record.save();

    const finalSeverity = mlResult?.severity || derived.severity;
    if (['Moderate', 'Severe', 'Critical'].includes(finalSeverity)) {
      await sendGuardianNotification(
        req.user.id,
        '🚨 Tachycardia/Bradycardia Alert',
        `ML Model ne ${finalSeverity} ${derived.hr_condition} detect ki — HR ${req.body.heart_rate} bpm`
      );
    }

    res.status(201).json({ success: true, message: '✅ TachyBrady data saved', data: record, ml_result: mlResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;