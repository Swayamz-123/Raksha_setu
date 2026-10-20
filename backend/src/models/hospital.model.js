import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  address: { type: String, default: '' },
  phone: { type: String, default: null },
  website: { type: String, default: null },
  emergency: { type: String, default: null },
  operator: { type: String, default: null },
  openingHours: { type: String, default: null },
  verified: { type: Boolean, default: false },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  source: { type: String, enum: ['osm', 'manual'], default: 'manual' }
}, { timestamps: true });

hospitalSchema.index({ location: '2dsphere' });

export const Hospital = mongoose.model('Hospital', hospitalSchema);
