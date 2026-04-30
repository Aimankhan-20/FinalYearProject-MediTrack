const express = require('express');
const router = express.Router();
const axios = require('axios');
const VitalReading = require('../models/VitalReadings');
const { guardianAuth } = require('./guardianAuthRoutes');

const PATIENT_API = 'http://192.168.1.7:5000';
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/guardian/vitals/latest
// Patient ka latest vital reading
// ─────────────────────────────────────────────────────────────────────────────
router.get('/latest', guardianAuth, async (req, res) => {
  try {
    const patientId = req.guardian.patientId;
    const latest = await VitalReading.findOne({ userId: patientId }).sort({ timestamp: -1 });

    if (!latest) {
      return res.status(404).json({ success: false, message: 'Koi vital reading nahi mili' });
    }

    res.json({ success: true, data: latest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/guardian/vitals/history
// Patient ki vital history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', guardianAuth, async (req, res) => {
  try {
    const patientId = req.guardian.patientId;
    const { limit = 20, startDate, endDate } = req.query;

    const query = { userId: patientId };
    if (startDate && endDate) {
      query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const readings = await VitalReading.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, count: readings.length, data: readings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/guardian/vitals/stats
// Patient ke 7 din ke stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', guardianAuth, async (req, res) => {
  try {
    const patientId = req.guardian.patientId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const readings = await VitalReading.find({
      userId: patientId,
      timestamp: { $gte: sevenDaysAgo },
    }).sort({ timestamp: -1 });

    if (!readings.length) {
      return res.json({ success: true, message: 'No data', stats: null });
    }

    const avg = (field) =>
      parseFloat((readings.reduce((s, r) => s + (r[field] || 0), 0) / readings.length).toFixed(2));

    res.json({
      success: true,
      stats: {
        totalReadings: readings.length,
        avgHeartRate: avg('heartRate'),
        avgBloodOxygen: avg('bloodOxygen'),
        avgTemperature: avg('temperature'),
        totalSteps: readings.reduce((s, r) => s + (r.footsteps || 0), 0),
        alerts: {
          critical: readings.filter(r => r.alertLevel === 'critical').length,
          warning: readings.filter(r => r.alertLevel === 'warning').length,
          normal: readings.filter(r => r.alertLevel === 'normal').length,
        },
        latestReading: readings[0],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// GET /api/guardian/vitals/location
router.get('/location', guardianAuth, async (req, res) => {
  try {
    const patientId = req.guardian.patientId;
    const response = await axios.get(`${PATIENT_API}/api/location/patient/${patientId}`, {
      timeout: 5000,
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;