import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { USER_ROLES, SKILL_TYPES } from '../constant.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true },
  avatar: { type: String, default: null },
  role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.USER },
  skills: [{
    type: { type: String, enum: Object.values(SKILL_TYPES) },
    verified: { type: Boolean, default: false },
    proofDocument: String
  }],
  trustScore: { type: Number, default: 1.0, min: 0, max: 1 },
  totalResponses: { type: Number, default: 0 },
  positiveRatings: { type: Number, default: 0 },
  falseAlerts: { type: Number, default: 0 },
  isSuspended: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },
  guardians: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isVulnerable: { type: Boolean, default: false },
  // Medical history for emergency responders
  medicalHistory: {
    bloodType: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'], default: 'Unknown' },
    allergies: [{ type: String, trim: true }],
    medications: [{ type: String, trim: true }],
    conditions: [{ type: String, trim: true }],
    emergencyNotes: { type: String, default: '' }
  },
  // Public token used for QR emergency card lookup
  emergencyCardToken: { type: String, unique: true, sparse: true, index: true, default: null },
  emergencyCardTokenCreatedAt: { type: Date, default: null },
  refreshToken: { type: String }
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, role: this.role },
    process.env.ACCESS_TOKEN_SECRET || "access-token-secret",
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d" }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET || "refresh-token-secret",
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "10d" }
  );
};

export const User = mongoose.model('User', userSchema);
