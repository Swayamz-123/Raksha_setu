import { User } from '../models/user.model.js';
import { getNearbyUsers } from './locationService.js';

const WEIGHT_ETA = parseFloat(process.env.WEIGHT_ETA) || 0.5;
const WEIGHT_SKILL = parseFloat(process.env.WEIGHT_SKILL) || 0.3;
const WEIGHT_TRUST = parseFloat(process.env.WEIGHT_TRUST) || 0.2;

const SKILL_CRISIS_MAP = {
  medical: ['cpr', 'first_aid', 'medical_professional'],
  accident: ['cpr', 'first_aid', 'medical_professional'],
  fire: ['fire_safety', 'first_aid'],
  crime: ['security'],
  natural_disaster: ['first_aid', 'fire_safety'],
  other: ['first_aid', 'security']
};

export const findBestResponders = async (longitude, latitude, crisisType, radiusMeters = 1000, batchSize = 10) => {
  const radiusKm = Number(radiusMeters) > 0 ? Number(radiusMeters) / 1000 : (parseFloat(process.env.SEARCH_RADIUS_KM) || 5);
  const nearbyUsers = await getNearbyUsers(longitude, latitude, radiusKm);
  if (nearbyUsers.length === 0) return [];

  const users = await User.find({
    _id: { $in: nearbyUsers.map(u => u.userId) },
    isActive: true,
    isSuspended: false,
    trustScore: { $gte: parseFloat(process.env.MIN_TRUST_SCORE) || 0.3 }
  }).select('_id name skills trustScore avatar');

  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  return nearbyUsers
    .filter(nearby => userMap.has(nearby.userId))
    .map(nearby => {
      const user = userMap.get(nearby.userId);
      const etaMinutes = nearby.distance * 2;
      const etaScore = etaMinutes > 0 ? 1 / etaMinutes : 10;
      const relevantSkills = SKILL_CRISIS_MAP[crisisType] || [];
      const hasRelevantSkill = relevantSkills.some(skill => user.skills.map(s => s.type).includes(skill));
      const skillScore = hasRelevantSkill ? 1.5 : 1.0;
      const totalScore = (WEIGHT_ETA * etaScore) + (WEIGHT_SKILL * skillScore) + (WEIGHT_TRUST * user.trustScore);
      return { userId: user._id, name: user.name, avatar: user.avatar, skills: user.skills, trustScore: user.trustScore, distance: nearby.distance, eta: Math.round(etaMinutes), score: totalScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, batchSize);
};
