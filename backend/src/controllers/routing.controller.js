import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getOptimalRoute, getNearestHospitalsWithRoutes } from '../services/routingService.js';
import { getNearbyHospitals } from '../services/hospital.service.js';
import { Hospital } from '../models/hospital.model.js';

// GET /api/routing/route?fromLat=&fromLng=&toLat=&toLng=
export const calculateRoute = asyncHandler(async (req, res) => {
    const { fromLat, fromLng, toLat, toLng, mode = 'car' } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) throw new ApiError(400, 'fromLat, fromLng, toLat, toLng are required');

    const route = await getOptimalRoute(
        parseFloat(fromLat), parseFloat(fromLng),
        parseFloat(toLat), parseFloat(toLng),
        mode
    );

    res.json(new ApiResponse(200, { route }, 'Route calculated'));
});

// GET /api/routing/nearest-hospitals?lat=&lng=&radius=
// Returns nearest hospitals sorted by ETA with routing info
export const nearestHospitalsWithRoutes = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10000 } = req.query;
    if (!lat || !lng) throw new ApiError(400, 'lat and lng are required');

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Try DB first, fall back to OSM
    let hospitals = await Hospital.find({
        location: {
            $near: {
                $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                $maxDistance: parseInt(radius)
            }
        }
    }).limit(10).lean();

    // If DB has fewer than 3, supplement with OSM
    if (hospitals.length < 3) {
        try {
            const osmHospitals = await getNearbyHospitals(latitude, longitude, parseInt(radius));
            // Normalize OSM format to match DB format
            const normalized = osmHospitals.map(h => ({
                _id: `osm_${h.id}`,
                name: h.name,
                location: { type: 'Point', coordinates: [h.location.lng, h.location.lat] },
                phone: h.phone,
                website: h.website,
                emergency: h.emergency,
                address: h.address,
                source: 'osm'
            }));
            // Merge, avoiding duplicates by name
            const existingNames = new Set(hospitals.map(h => h.name?.toLowerCase()));
            const newOSM = normalized.filter(h => !existingNames.has(h.name?.toLowerCase()));
            hospitals = [...hospitals, ...newOSM].slice(0, 10);
        } catch {}
    }

    const withRoutes = await getNearestHospitalsWithRoutes(latitude, longitude, hospitals, 5);

    res.json(new ApiResponse(200, {
        count: withRoutes.length,
        hospitals: withRoutes.map(item => ({
            ...item.hospital,
            eta: item.route.etaMinutes,
            distanceKm: (item.route.distanceMeters / 1000).toFixed(1),
            trafficDelay: item.route.trafficDelaySeconds,
            routePolyline: item.route.polyline,
            routeInstructions: item.route.instructions,
            routeFallback: item.route.fallback || false
        }))
    }, 'Nearest hospitals with routes'));
});
