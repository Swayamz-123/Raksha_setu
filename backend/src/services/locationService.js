import { getRedisClient } from '../config/redis.js';
import { User } from '../models/user.model.js';

const GEO_KEY_RESPONDERS = 'geo:responders';
const HEARTBEAT_PREFIX = 'responder:heartbeat:';
const HEARTBEAT_TTL_SECONDS = 300; // 5 minutes

// Local in-memory fallback in case Redis is temporarily disconnected
const fallbackLocations = new Map();

/**
 * Updates a user's location in Redis Geospatial index and refreshes heartbeat
 * @param {string} userId
 * @param {number} longitude
 * @param {number} latitude
 */
export const updateUserLocation = async (userId, longitude, latitude) => {
  const uid = userId.toString();
  const lng = Number(longitude);
  const lat = Number(latitude);

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    throw new Error('Invalid coordinates supplied for location update');
  }

  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    // 1. Update geospatial coordinate in Sorted Set
    pipeline.geoadd(GEO_KEY_RESPONDERS, lng, lat, uid);

    // 2. Refresh TTL heartbeat key (auto-expires stale users)
    pipeline.set(`${HEARTBEAT_PREFIX}${uid}`, `${lng},${lat}`, 'EX', HEARTBEAT_TTL_SECONDS);

    await pipeline.exec();
  } catch (err) {
    console.warn('[LocationService] Redis write failed, using memory fallback:', err.message);
    fallbackLocations.set(uid, { longitude: lng, latitude: lat, timestamp: Date.now() });
  }

  // Update DB active status asynchronously (fire-and-forget to avoid blocking event loop)
  User.findByIdAndUpdate(userId, { isActive: true }).catch((err) => {
    console.error('[LocationService] Failed to mark user as active in DB:', err.message);
  });
};

/**
 * High-performance Redis Geospatial proximity lookup ($O(\log N)$)
 * @param {number} longitude
 * @param {number} latitude
 * @param {number} radiusKm
 * @returns {Promise<Array<{ userId: string, distance: number, coordinates?: [number, number] }>>}
 */
export const getNearbyUsers = async (longitude, latitude, radiusKm = 5) => {
  const lng = Number(longitude);
  const lat = Number(latitude);
  const rad = Number(radiusKm) || 5;

  try {
    const redis = getRedisClient();

    // GEOSEARCH geo:responders FROMLONLAT <lng> <lat> BYRADIUS <rad> km WITHDIST WITHCOORD ASC
    const rawResults = await redis.geosearch(
      GEO_KEY_RESPONDERS,
      'FROMLONLAT',
      lng,
      lat,
      'BYRADIUS',
      rad,
      'km',
      'WITHDIST',
      'WITHCOORD',
      'ASC'
    );

    if (!rawResults || rawResults.length === 0) {
      return [];
    }

    // Check active heartbeats to filter out dead connections
    const uids = rawResults.map((r) => r[0]);
    const heartbeatKeys = uids.map((id) => `${HEARTBEAT_PREFIX}${id}`);
    const heartbeats = await redis.mget(heartbeatKeys);

    const validResponders = [];
    const staleUids = [];

    rawResults.forEach((entry, idx) => {
      const uid = entry[0];
      const distance = parseFloat(entry[1]);
      const coords = entry[2]; // [lng, lat]
      const hasHeartbeat = heartbeats[idx] !== null;

      if (hasHeartbeat) {
        validResponders.push({
          userId: uid,
          distance: Number(distance.toFixed(2)),
          coordinates: coords ? [parseFloat(coords[0]), parseFloat(coords[1])] : [lng, lat]
        });
      } else {
        staleUids.push(uid);
      }
    });

    // Lazy cleanup of stale users from geospatial index
    if (staleUids.length > 0) {
      redis.zrem(GEO_KEY_RESPONDERS, ...staleUids).catch(() => {});
    }

    return validResponders;
  } catch (err) {
    console.warn('[LocationService] Redis GEOSEARCH failed, using fallback:', err.message);
    return getNearbyUsersFallback(lng, lat, rad);
  }
};

/**
 * Removes user from Redis Geospatial index upon disconnection
 * @param {string} userId
 */
export const removeUserLocation = async (userId) => {
  const uid = userId.toString();

  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.zrem(GEO_KEY_RESPONDERS, uid);
    pipeline.del(`${HEARTBEAT_PREFIX}${uid}`);
    await pipeline.exec();
  } catch (err) {
    fallbackLocations.delete(uid);
  }

  User.findByIdAndUpdate(userId, { isActive: false }).catch(() => {});
};

/**
 * Fetches specific user coordinates from Redis
 * @param {string} userId
 */
export const getUserLocation = async (userId) => {
  const uid = userId.toString();

  try {
    const redis = getRedisClient();
    const pos = await redis.geopos(GEO_KEY_RESPONDERS, uid);
    if (pos && pos[0]) {
      return {
        longitude: parseFloat(pos[0][0]),
        latitude: parseFloat(pos[0][1])
      };
    }
  } catch (err) {
    // Check fallback
  }

  const mem = fallbackLocations.get(uid);
  return mem ? { longitude: mem.longitude, latitude: mem.latitude } : null;
};

// --- In-Memory Fallback Implementation ---
function getNearbyUsersFallback(lng, lat, radiusKm) {
  const nearby = [];
  const now = Date.now();

  for (const [uid, loc] of fallbackLocations.entries()) {
    if (now - loc.timestamp > HEARTBEAT_TTL_SECONDS * 1000) {
      fallbackLocations.delete(uid);
      continue;
    }
    const dist = calculateHaversineDistance(lat, lng, loc.latitude, loc.longitude);
    if (dist <= radiusKm) {
      nearby.push({ userId: uid, distance: Number(dist.toFixed(2)) });
    }
  }
  return nearby;
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
