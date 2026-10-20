import { Ambulance } from '../models/ambulance.model.js';
import { SOS } from '../models/sos.model.js';
import { AMBULANCE_STATUS } from '../constant.js';
import { getOptimalRoute } from './routingService.js';

export const getNearbyAvailableAmbulances = async (lat, lng, radius = 15000, limit = 5) => {
  const ambulances = await Ambulance.find({
    status: AMBULANCE_STATUS.AVAILABLE,
    isAvailable: true,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius
      }
    }
  }).limit(limit);

  return Promise.all(ambulances.map(async (a) => {
    const [aLng, aLat] = a.location.coordinates;
    const route = await getOptimalRoute(aLat, aLng, lat, lng, 'car');
    return {
      _id: a._id,
      name: a.name,
      vehicleNumber: a.vehicleNumber,
      phone: a.phone,
      etaMinutes: route.etaMinutes,
      distanceKm: Number((route.distanceMeters / 1000).toFixed(1)),
      location: a.location
    };
  }));
};

export const assignAmbulancesToSOS = async (sosId, lat, lng, count = 2) => {
  const candidates = await getNearbyAvailableAmbulances(lat, lng, 25000, 8);
  const assigned = [];

  for (const candidate of candidates) {
    if (assigned.length >= count) break;

    const updated = await Ambulance.findOneAndUpdate(
      { _id: candidate._id, status: AMBULANCE_STATUS.AVAILABLE, isAvailable: true, currentSOS: null },
      { $set: { status: AMBULANCE_STATUS.BUSY, isAvailable: false, currentSOS: sosId } },
      { new: true }
    );

    if (!updated) continue;

    await SOS.findByIdAndUpdate(
      sosId,
      {
        $push: {
          ambulanceDispatches: {
            ambulance: updated._id,
            etaMinutes: candidate.etaMinutes,
            distanceKm: candidate.distanceKm,
            status: 'assigned'
          }
        }
      }
    );

    assigned.push({
      _id: updated._id,
      name: updated.name,
      vehicleNumber: updated.vehicleNumber,
      phone: updated.phone,
      etaMinutes: candidate.etaMinutes,
      distanceKm: candidate.distanceKm,
      location: updated.location
    });
  }

  return assigned;
};

export const releaseAmbulancesForSOS = async (sosId) => {
  await Ambulance.updateMany(
    { currentSOS: sosId },
    { $set: { currentSOS: null, status: AMBULANCE_STATUS.AVAILABLE, isAvailable: true } }
  );

  await SOS.updateOne(
    { _id: sosId },
    { $set: { 'ambulanceDispatches.$[entry].status': 'completed' } },
    { arrayFilters: [{ 'entry.status': 'assigned' }] }
  );
};
