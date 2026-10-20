import mongoose from 'mongoose';
import { AMBULANCE_STATUS } from '../constant.js';

const ambulanceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  vehicleNumber: { type: String, required: true, unique: true, trim: true },
  phone: { type: String, default: null },
  provider: { type: String, default: 'community' },
  status: { type: String, enum: Object.values(AMBULANCE_STATUS), default: AMBULANCE_STATUS.AVAILABLE },
  isAvailable: { type: Boolean, default: true },
  currentSOS: { type: mongoose.Schema.Types.ObjectId, ref: 'SOS', default: null },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

ambulanceSchema.index({ location: '2dsphere' });
ambulanceSchema.index({ status: 1, isAvailable: 1 });

export const Ambulance = mongoose.model('Ambulance', ambulanceSchema);
