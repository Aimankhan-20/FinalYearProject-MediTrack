const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS ko properly configure kiya hai taake mobile requests block na hon
app.use(cors());
app.use(express.json());

// Routes
const { router: guardianAuthRouter } = require('./routes/guardianAuthRoutes');
const guardianVitalsRouter = require('./routes/guardianVitalsRoutes');
const guardianReportsRouter = require('./routes/guardianReportsRoutes');

app.use('/api/guardian/auth', guardianAuthRouter);
app.use('/api/guardian/vitals', guardianVitalsRouter);
app.use('/api/guardian/reports', guardianReportsRouter);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Guardian Backend — MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const PORT = process.env.PORT || 5001;

// '0.0.0.0' lagane se server local network par visible ho jata hai
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Guardian server running on http:/192.168.1.7:${PORT}`);
});