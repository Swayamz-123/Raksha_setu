import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getNearbyHospitals } from "../services/hospital.service.js";
import { Hospital } from "../models/hospital.model.js";

// GET /api/hospitals/nearby?lat=&lng=&radius=
// Fetches from OpenStreetMap via Overpass API (live, no auth needed)
export const fetchNearbyHospitals = asyncHandler(async (req, res) => {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) throw new ApiError(400, "Both 'lat' and 'lng' query parameters are required");

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) throw new ApiError(400, "'lat' and 'lng' must be valid numbers");
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new ApiError(400, "Invalid coordinates");

    const searchRadius = radius ? parseInt(radius, 10) : 5000;
    if (Number.isNaN(searchRadius) || searchRadius < 1 || searchRadius > 50000) throw new ApiError(400, "Radius must be between 1 and 50000 metres");

    const hospitals = await getNearbyHospitals(latitude, longitude, searchRadius);

    return res.status(200).json(new ApiResponse(200, { count: hospitals.length, hospitals },
        hospitals.length ? "Nearby hospitals fetched successfully" : "No hospitals found within the specified radius"
    ));
});

// GET /api/hospitals/db/nearby?lat=&lng=&radius=
// Fetches from our own MongoDB (manually added hospitals)
export const getNearbyFromDB = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10000 } = req.query;
    if (!lat || !lng) throw new ApiError(400, "lat and lng are required");

    const hospitals = await Hospital.find({
        location: {
            $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                $maxDistance: parseInt(radius)
            }
        }
    }).populate('addedBy', 'name').limit(50);

    res.json(new ApiResponse(200, { count: hospitals.length, hospitals }, 'Hospitals retrieved'));
});

// GET /api/hospitals/db — get all hospitals in DB
export const getAllFromDB = asyncHandler(async (req, res) => {
    const hospitals = await Hospital.find().populate('addedBy', 'name').sort({ createdAt: -1 });
    res.json(new ApiResponse(200, { count: hospitals.length, hospitals }, 'All hospitals retrieved'));
});

// POST /api/hospitals/db — add a hospital manually (auth required)
export const addHospital = asyncHandler(async (req, res) => {
    const { name, latitude, longitude, address, phone, website, emergency, operator, openingHours } = req.body;

    if (!name || latitude === undefined || longitude === undefined) {
        throw new ApiError(400, 'name, latitude, and longitude are required');
    }

    const hospital = await Hospital.create({
        name,
        location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
        address: address || '',
        phone: phone || null,
        website: website || null,
        emergency: emergency || null,
        operator: operator || null,
        openingHours: openingHours || null,
        addedBy: req.user._id,
        source: 'manual'
    });

    res.status(201).json(new ApiResponse(201, { hospital }, 'Hospital added successfully'));
});

// PUT /api/hospitals/db/:id — update a hospital (auth required)
export const updateHospital = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = {};
    const fields = ['name', 'address', 'phone', 'website', 'emergency', 'operator', 'openingHours', 'verified'];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
        updates.location = { type: 'Point', coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)] };
    }

    const hospital = await Hospital.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!hospital) throw new ApiError(404, 'Hospital not found');

    res.json(new ApiResponse(200, { hospital }, 'Hospital updated'));
});

// DELETE /api/hospitals/db/:id — delete a hospital (admin only)
export const deleteHospital = asyncHandler(async (req, res) => {
    const hospital = await Hospital.findByIdAndDelete(req.params.id);
    if (!hospital) throw new ApiError(404, 'Hospital not found');
    res.json(new ApiResponse(200, {}, 'Hospital deleted'));
});

// POST /api/hospitals/db/seed — import OSM results into DB
export const seedHospitalsFromOSM = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10000 } = req.body;
    if (!lat || !lng) throw new ApiError(400, 'lat and lng are required');

    const osmHospitals = await getNearbyHospitals(parseFloat(lat), parseFloat(lng), parseInt(radius));

    let inserted = 0;
    for (const h of osmHospitals) {
        if (!h.location?.lat || !h.location?.lng) continue;
        const exists = await Hospital.findOne({ 'location.coordinates': [h.location.lng, h.location.lat] });
        if (!exists) {
            await Hospital.create({
                name: h.name,
                location: { type: 'Point', coordinates: [h.location.lng, h.location.lat] },
                address: h.address || '',
                phone: h.phone || null,
                website: h.website || null,
                emergency: h.emergency || null,
                operator: h.operator || null,
                openingHours: h.openingHours || null,
                source: 'osm',
                verified: true
            });
            inserted++;
        }
    }

    res.status(201).json(new ApiResponse(201, { total: osmHospitals.length, inserted }, `Seeded ${inserted} new hospitals from OSM`));
});
