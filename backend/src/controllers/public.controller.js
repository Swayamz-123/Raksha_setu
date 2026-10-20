import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getEmergencyCardByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token) throw new ApiError(400, 'Token is required');

  const user = await User.findOne({ emergencyCardToken: token })
    .populate('guardians', 'name phone email')
    .select('name phone medicalHistory guardians emergencyCardTokenCreatedAt');

  if (!user) throw new ApiError(404, 'Emergency card not found');

  const payload = {
    name: user.name,
    phone: user.phone,
    medicalHistory: user.medicalHistory || null,
    guardians: (user.guardians || []).map(g => ({
      _id: g._id,
      name: g.name,
      phone: g.phone,
      email: g.email
    })),
    tokenCreatedAt: user.emergencyCardTokenCreatedAt
  };

  res.json(new ApiResponse(200, { user: payload }, 'Emergency card retrieved'));
});
