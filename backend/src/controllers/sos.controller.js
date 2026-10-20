import { SOS } from '../models/sos.model.js';
import { Resource } from '../models/resource.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateDebriefPrompt, FALLBACK_GUIDANCE } from '../utils/aiService.js';
import { SOS_STATUS } from '../constant.js';
import { emitSOSResolved } from '../socket/index.js';
import { releaseAmbulancesForSOS } from '../services/ambulanceDispatch.service.js';
import { enqueueSOSDispatch } from '../queues/sosQueue.js';
import { withDistributedLock } from '../utils/distributedLock.js';
import { assertValidSOSTransition } from '../utils/stateMachine.js';

export const createSOS = asyncHandler(async (req, res) => {
  const { crisisType, longitude, latitude, address, isAnonymous, broadcastRadius } = req.body;
  if (!crisisType || longitude === undefined || latitude === undefined) {
    throw new ApiError(400, 'Crisis type and location are required');
  }
  
  // Rate limiting: Check if user already has an active SOS
  const activeSOS = await SOS.findOne({ broadcaster: req.user._id, status: SOS_STATUS.ACTIVE });
  if (activeSOS) throw new ApiError(400, "You already have an active SOS alert. Please resolve it first.");

  // Check for suspended users
  if (req.user.isSuspended) throw new ApiError(403, "Your account is suspended. You cannot broadcast SOS alerts.");

  const normalizedRadius = Number(broadcastRadius) || 1000;
  if (![500, 1000, 2000].includes(normalizedRadius)) {
    throw new ApiError(400, 'Broadcast radius must be 500, 1000, or 2000');
  }

  // Fast-path: Immediate DB insertion with deterministic fallback triage (< 25ms)
  const initialGuidance = FALLBACK_GUIDANCE[crisisType] || FALLBACK_GUIDANCE.other;
  const sos = await SOS.create({
    broadcaster: req.user._id,
    crisisType,
    location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
    address: address || '',
    isAnonymous: isAnonymous || false,
    broadcastRadius: normalizedRadius,
    dispatchStatus: 'queued',
    aiGuidance: initialGuidance,
    emergencySummary: `${crisisType.toUpperCase()} emergency reported at ${address || 'coordinates shared'}. Dispatching nearest units.`
  });

  // Query indexed static emergency POIs (police, hospital, fire) in parallel
  const nearbyResources = await Resource.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
        $maxDistance: 5000
      }
    },
    type: { $in: ['hospital', 'police_station', 'fire_station'] }
  }).limit(5).lean().catch(() => []);

  // Asynchronously dispatch to BullMQ queue (handles responders, ambulances, Gemini AI, email fanout)
  await enqueueSOSDispatch({
    sosId: sos._id.toString(),
    broadcasterId: req.user._id.toString(),
    crisisType,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: address || '',
    broadcastRadius: normalizedRadius,
    isAnonymous: isAnonymous || false
  });

  // Return HTTP 202 Accepted immediately to client (< 80ms p99)
  res.status(202).json(new ApiResponse(202, {
    sos,
    guidance: initialGuidance,
    nearbyResources,
    dispatchStatus: 'queued',
    trackingId: sos._id
  }, 'SOS alert accepted. Emergency units and community responders are being dispatched asynchronously.'));
});

export const acceptSOS = asyncHandler(async (req, res) => {
  const { sosId } = req.params;
  const responderId = req.user._id.toString();

  const lockResource = `sos:accept:${sosId}`;

  const result = await withDistributedLock(lockResource, 5000, async () => {
    // 1. Prevent a responder from taking multiple concurrent emergencies
    const existingAssignment = await SOS.findOne({
      status: { $in: [SOS_STATUS.ACTIVE, SOS_STATUS.RESPONDING] },
      'responders.user': req.user._id
    }).select('_id status');

    if (existingAssignment) {
      throw new ApiError(400, 'You are already responding to an active SOS alert.');
    }

    // 2. Fetch current SOS
    const sos = await SOS.findById(sosId);
    if (!sos) throw new ApiError(404, 'SOS alert not found');

    // 3. Finite State Machine assertion
    assertValidSOSTransition(sos.status, SOS_STATUS.RESPONDING, sosId);

    // 4. Ensure no one already took the primary slot if it's full
    if (sos.responders && sos.responders.length > 0) {
      if (sos.responders.some(r => r.user.toString() === responderId)) {
        return { sos, alreadyAccepted: true };
      }
      throw new ApiError(409, 'This emergency alert has already been claimed by another responder.');
    }

    // 5. Atomic state update
    const acceptedAt = new Date();
    sos.status = SOS_STATUS.RESPONDING;
    sos.responders.push({ user: req.user._id, acceptedAt });
    sos.timeToAcceptance = (acceptedAt.getTime() - new Date(sos.createdAt).getTime()) / 1000;
    await sos.save();

    return { sos, alreadyAccepted: false };
  });

  res.status(200).json(new ApiResponse(200, result, 'SOS alert successfully accepted.'));
});

export const resolveSOS = asyncHandler(async (req, res) => {
  const { sosId } = req.params;
  const lockResource = `sos:resolve:${sosId}`;

  const result = await withDistributedLock(lockResource, 5000, async () => {
    const sos = await SOS.findById(sosId);
    if (!sos) throw new ApiError(404, 'SOS not found');
    if (sos.broadcaster.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Only the broadcaster can resolve this SOS alert.');
    }

    // Finite State Machine check
    assertValidSOSTransition(sos.status, SOS_STATUS.RESOLVED, sosId);

    sos.status = SOS_STATUS.RESOLVED;
    sos.resolvedAt = new Date();
    sos.timeToResolution = (Date.now() - new Date(sos.createdAt).getTime()) / 1000;
    sos.welfareCheckDue = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await releaseAmbulancesForSOS(sos._id);
    await sos.save();

    const debrief = await generateDebriefPrompt(sos.crisisType, sos.timeToResolution, sos.responders.length);
    emitSOSResolved({
      sosId: sos._id.toString(),
      resolvedAt: sos.resolvedAt,
      debrief,
      broadcasterId: sos.broadcaster,
      responderIds: sos.responders.map(e => e.user)
    });

    return { sos, debrief };
  });

  res.json(new ApiResponse(200, result, 'SOS resolved successfully.'));
});

export const rateResponder = asyncHandler(async (req, res) => {
  const { sosId, responderId } = req.params;
  const { rating } = req.body;
  const sos = await SOS.findById(sosId);
  if (!sos || sos.broadcaster.toString() !== req.user._id.toString()) throw new ApiError(403, 'Unauthorized');
  const idx = sos.responders.findIndex(r => r.user.toString() === responderId);
  if (idx === -1) throw new ApiError(404, 'Responder not found');
  sos.responders[idx].rating = rating;
  await sos.save();
  const user = await User.findById(responderId);
  user.totalResponses += 1;
  if (rating >= 3) user.positiveRatings += 1;
  user.trustScore = user.totalResponses > 0 ? user.positiveRatings / user.totalResponses : 1.0;
  await user.save();
  res.json(new ApiResponse(200, null, 'Rating submitted'));
});

export const flagFalseAlert = asyncHandler(async (req, res) => {
  const sos = await SOS.findById(req.params.sosId);
  if (!sos) throw new ApiError(404, 'SOS not found');
  sos.isFalseAlert = true;
  await sos.save();
  const broadcaster = await User.findById(sos.broadcaster);
  broadcaster.falseAlerts += 1;
  broadcaster.trustScore = Math.max(0, broadcaster.trustScore - 0.2);
  if (broadcaster.trustScore < 0.3) broadcaster.isSuspended = true;
  await broadcaster.save();
  res.json(new ApiResponse(200, null, 'Alert flagged'));
});

export const getActiveSOS = asyncHandler(async (req, res) => {
  const activeSOS = await SOS.find({ status: SOS_STATUS.ACTIVE }).populate('broadcaster', 'name phone avatar').populate('responders.user', 'name phone avatar').sort({ createdAt: -1 });
  res.json(new ApiResponse(200, { activeSOS }, 'Active SOS retrieved'));
});

export const getPendingSOS = asyncHandler(async (req, res) => {
  const pendingSOS = await SOS.find({ status: { $in: [SOS_STATUS.ACTIVE, SOS_STATUS.RESPONDING] } }).populate('broadcaster', 'name phone avatar').populate('responders.user', 'name phone avatar').sort({ createdAt: -1 });
  const safePendingSOS = pendingSOS.map(entry => {
    const data = entry.toObject();
    if (data.isAnonymous && data.broadcaster?._id?.toString() !== req.user?._id?.toString()) data.broadcaster = null;
    return data;
  });
  res.json(new ApiResponse(200, { pendingSOS: safePendingSOS }, 'Pending SOS retrieved'));
});

export const getSOSById = asyncHandler(async (req, res) => {
  const sos = await SOS.findById(req.params.sosId)
    .populate('broadcaster', 'name phone avatar')
    .populate('responders.user', 'name phone avatar skills trustScore')
    .populate('ambulanceDispatches.ambulance', 'name phone vehicleNumber location status');
  if (!sos) throw new ApiError(404, 'SOS not found');
  let safeSOS = sos.toObject();
  if (safeSOS.isAnonymous && safeSOS.broadcaster?._id?.toString() !== req.user?._id?.toString()) safeSOS.broadcaster = null;
  const [lng, lat] = safeSOS.location.coordinates;
  const nearbyResources = await Resource.find({ location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: 5000 } } }).limit(20);
  const nearbyAmbulances = await getNearbyAvailableAmbulances(Number(lat), Number(lng), 15000, 5);
  res.json(new ApiResponse(200, { sos: safeSOS, guidance: safeSOS.aiGuidance, emergencySummary: safeSOS.emergencySummary, nearbyResources, nearbyAmbulances }, 'SOS details retrieved'));
});

export const getMyHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [broadcasted, responded] = await Promise.all([
    SOS.find({ broadcaster: userId }).populate('responders.user', 'name avatar skills trustScore').sort({ createdAt: -1 }).limit(50),
    SOS.find({ 'responders.user': userId }).populate('broadcaster', 'name avatar').populate('responders.user', 'name avatar skills trustScore').sort({ createdAt: -1 }).limit(50)
  ]);
  const respondedWithRating = responded.map(sos => {
    const entry = sos.responders.find(r => r.user?._id?.toString() === userId.toString());
    return { ...sos.toObject(), myRating: entry?.rating ?? null, myAcceptedAt: entry?.acceptedAt || null };
  });
  res.json(new ApiResponse(200, { broadcasted, responded: respondedWithRating }, 'History retrieved'));
});

export const getPendingWelfareChecks = asyncHandler(async (req, res) => {
  const pendingChecks = await SOS.find({ broadcaster: req.user._id, status: SOS_STATUS.RESOLVED, welfareCheckDue: { $lte: new Date() }, welfareCheckResponse: null }).select('crisisType address resolvedAt welfareCheckDue welfareCheckSent').sort({ resolvedAt: -1 }).limit(10);
  const ids = pendingChecks.map(s => s._id);
  if (ids.length > 0) await SOS.updateMany({ _id: { $in: ids }, welfareCheckSent: false }, { $set: { welfareCheckSent: true } });
  res.json(new ApiResponse(200, { welfareChecks: pendingChecks }, 'Pending welfare checks retrieved'));
});

export const respondToWelfareCheck = asyncHandler(async (req, res) => {
  const { response } = req.body;
  if (!['fine', 'need_help'].includes(response)) throw new ApiError(400, 'Response must be "fine" or "need_help"');
  const sos = await SOS.findById(req.params.sosId);
  if (!sos) throw new ApiError(404, 'SOS not found');
  if (sos.broadcaster.toString() !== req.user._id.toString()) throw new ApiError(403, 'Only broadcaster can respond');
  sos.welfareCheckResponse = response;
  sos.welfareCheckRespondedAt = new Date();
  await sos.save();
  res.json(new ApiResponse(200, { sos }, 'Welfare check response recorded'));
});
