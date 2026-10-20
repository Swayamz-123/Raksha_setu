import { Ambulance } from '../models/ambulance.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AMBULANCE_STATUS } from '../constant.js';

export const addAmbulance = asyncHandler(async (req, res) => {
  const { name, vehicleNumber, phone, provider, latitude, longitude } = req.body;
  if (!name || !vehicleNumber || latitude === undefined || longitude === undefined) {
    throw new ApiError(400, 'name, vehicleNumber, latitude, longitude are required');
  }

  const ambulance = await Ambulance.create({
    name,
    vehicleNumber,
    phone: phone || null,
    provider: provider || 'community',
    location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
    addedBy: req.user?._id || null
  });

  res.status(201).json(new ApiResponse(201, { ambulance }, 'Ambulance added'));
});

export const getAllAmbulances = asyncHandler(async (_req, res) => {
  const ambulances = await Ambulance.find().sort({ createdAt: -1 });
  res.json(new ApiResponse(200, { count: ambulances.length, ambulances }, 'Ambulances retrieved'));
});

export const getNearbyAmbulances = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 15000, includeBusy = 'false' } = req.query;
  if (!lat || !lng) throw new ApiError(400, 'lat and lng are required');

  const query = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(radius, 10)
      }
    }
  };

  if (includeBusy !== 'true') {
    query.status = AMBULANCE_STATUS.AVAILABLE;
    query.isAvailable = true;
  }

  const ambulances = await Ambulance.find(query).limit(25);
  res.json(new ApiResponse(200, { count: ambulances.length, ambulances }, 'Nearby ambulances retrieved'));
});

export const updateAmbulance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, provider, latitude, longitude } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (provider !== undefined) updates.provider = provider;
  if (latitude !== undefined && longitude !== undefined) {
    updates.location = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
  }

  const ambulance = await Ambulance.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
  if (!ambulance) throw new ApiError(404, 'Ambulance not found');

  res.json(new ApiResponse(200, { ambulance }, 'Ambulance updated'));
});

export const updateAmbulanceStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!Object.values(AMBULANCE_STATUS).includes(status)) {
    throw new ApiError(400, `status must be one of: ${Object.values(AMBULANCE_STATUS).join(', ')}`);
  }

  const patch = {
    status,
    isAvailable: status === AMBULANCE_STATUS.AVAILABLE
  };

  if (status !== AMBULANCE_STATUS.BUSY) patch.currentSOS = null;

  const ambulance = await Ambulance.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  if (!ambulance) throw new ApiError(404, 'Ambulance not found');

  res.json(new ApiResponse(200, { ambulance }, 'Ambulance status updated'));
});

export const deleteAmbulance = asyncHandler(async (req, res) => {
  const ambulance = await Ambulance.findByIdAndDelete(req.params.id);
  if (!ambulance) throw new ApiError(404, 'Ambulance not found');
  res.json(new ApiResponse(200, {}, 'Ambulance deleted'));
});

export const seedAmbulances = asyncHandler(async (req, res) => {
  const { longitude, latitude, count = 5 } = req.body;
  if (longitude === undefined || latitude === undefined) throw new ApiError(400, 'longitude and latitude are required');

  const rows = Array.from({ length: Math.max(1, Math.min(Number(count), 20)) }).map((_, i) => ({
    name: `Ambulance Unit ${i + 1}`,
    vehicleNumber: `AMB-${Date.now().toString().slice(-5)}-${i + 1}`,
    phone: null,
    provider: 'demo',
    location: {
      type: 'Point',
      coordinates: [
        parseFloat(longitude) + (Math.random() - 0.5) * 0.05,
        parseFloat(latitude) + (Math.random() - 0.5) * 0.05
      ]
    },
    addedBy: req.user?._id || null
  }));

  const ambulances = await Ambulance.insertMany(rows);
  res.status(201).json(new ApiResponse(201, { count: ambulances.length, ambulances }, 'Sample ambulances seeded'));
});
