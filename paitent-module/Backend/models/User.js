const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  // Authentication Fields
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
  },

  // Profile Fields
  fullName: {
    type: String,
    default: function() { return this.name; }
  },
 profilePhoto: {
  type: String,
  default: null,
},
  patientId: {
    type: String,
    unique: true,
  },
  status: {
    type: String,
    default: "Active",
    enum: ["Active", "Inactive", "Monitoring"],
  },
  monitoringSince: {
    type: String,
    default: function() {
      const date = new Date();
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  },

  // Personal Information
  age: { type: String, default: "" },
  gender: { type: String, default: "Female", enum: ["Male", "Female", "Other"] },
  dateOfBirth: { type: String, default: "" },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },

  // Medical Information
 
bloodType: { type: String, default: "" },
height: { type: String, default: "" },      // 
weight: { type: String, default: "" },      // 
bmi: { type: Number, default: null },       // 
allergies: { type: String, default: "" },
medicalHistory: { type: String, default: "" },

  // Health Summary
  dayMonitored: { type: Number, default: 0 },
normalReadings: { type: String, default: "0%" },   
alerts: { type: Number, default: 0 },
healthScore: { type: String, default: "N/A" },

  // ✅ Expo Push Token for notifications
  expoPushToken: {
    type: String,
    default: null,
  },

  // ✅ NEW: Manual Vitals (BP, Blood Sugar, Body Temp)
  // Ye patient profile mein manually enter karta hai
  vitals: {
    bpSystolic:   { type: Number, default: null },  // mmHg
    bpDiastolic:  { type: Number, default: null },  // mmHg
    bloodSugar:   { type: Number, default: null },  // mg/dL
    temperature:  { type: Number, default: null },  // °F
    recordedAt:   { type: Date,   default: null },  // Last update time

    // ✅ NEW: Condition status — normal ya abnormal
    // Ye check karne ke liye ke kitni der baad remind karna hai
    // normal    → 1 din baad remind
    // abnormal  → 1 ghante baad remind
    vitalsStatus: {
      type: String,
      enum: ['normal', 'abnormal'],
      default: 'normal',
    },

    // ✅ NEW: Next update reminder time
    // Backend calculate karega based on vitalsStatus
    nextReminderAt: { type: Date, default: null },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Generate unique Patient ID
userSchema.pre("save", async function (next) {
  // Hash password if modified
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // Generate Patient ID if new user
  if (this.isNew && !this.patientId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.patientId = `PW${year}${month}-${random}`;
  }

  // Update timestamp
  this.updatedAt = Date.now();
  
  next();
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without password)
userSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);