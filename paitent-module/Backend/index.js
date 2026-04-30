const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const os = require('os'); 
dotenv.config();

const app = express();
const predictRoutes = require("./routes/predictRoutes");

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/api/predict", predictRoutes);
app.use("/uploads", express.static("uploads"));
// ✅ MongoDB Connection (No deprecated warnings)
mongoose.connect(process.env.MONGO_URI, {
  dbName: 'MediTrack'
})
  .then(() => {
    console.log("✅ MongoDB Atlas Connected Successfully");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// Monitor connection
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "MediTrack Backend API is running...",
    status: "active",
    database: mongoose.connection.db.databaseName,
    endpoints: {
      auth: "/api/auth",
      vitals: "/api/vitals",
      ai: "/api/ai",
      contact: "/api/contact",
      emergencyContacts: "/api/emergency-contacts",
    }
  });
});

// ✅ ROUTES
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
console.log("✅ Auth routes loaded");


const contactRoutes = require("./routes/contactRoutes");
app.use("/api/contact", contactRoutes);
console.log("✅ Contact routes loaded");

const emergencyContactRoutes = require("./routes/emergencyContactRoutes");
app.use("/api/emergency-contacts", emergencyContactRoutes);
console.log("✅ Emergency contact routes loaded");

const vitalRoutes = require("./routes/vitalRoutes");  
app.use("/api/vitals", vitalRoutes);
console.log("✅ Vitals routes loaded");

const aiAnalysisRoutes = require('./routes/aiAnalysis');
app.use('/api/ai', aiAnalysisRoutes);
console.log("✅ AI Analysis routes loaded at /api/ai");

const userRoutes = require('./routes/userRoutes');
app.use('/api/user', userRoutes);

const locationRoutes = require('./routes/locationRoutes');
app.use('/api/location', locationRoutes);
console.log("✅ Location routes loaded");
// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ 
    error: "Something went wrong!",
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "Route not found",
    requestedUrl: req.url,
    method: req.method
  });
});

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};  

const LOCAL_IP = getLocalIP(); 
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ====================================`);
  console.log(`🚀 SERVER RUNNING SUCCESSFULLY`);
  console.log(`🚀 ====================================`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📱 Network: http://${LOCAL_IP}:${PORT}`);
  console.log(`📊 Database: MediTrack (Atlas)`);
  console.log(`\n📍 API Endpoints:`);
  console.log(`   - Root: http://${LOCAL_IP}:${PORT}`);
  console.log(`   - Auth: http://${LOCAL_IP}:${PORT}/api/auth`);
  console.log(`   - Vitals: http://${LOCAL_IP}:${PORT}/api/vitals`);
  console.log(`   - AI: http://${LOCAL_IP}:${PORT}/api/ai`);
  console.log(`   - Contact: http://${LOCAL_IP}:${PORT}/api/contact`);
  console.log(`   - Emergency: http://${LOCAL_IP}:${PORT}/api/emergency-contacts`);
  console.log(`🚀 ====================================\n`);
  console.log(`💡 React Native App URL: http://${LOCAL_IP}:${PORT}`);
  console.log(`💡 Make sure device is on same WiFi\n`);
});
