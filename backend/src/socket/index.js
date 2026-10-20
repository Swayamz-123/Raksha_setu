import { Server } from 'socket.io';
import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { createAdapter } from '@socket.io/redis-adapter';
import { createNewRedisClient } from '../config/redis.js';
import { SOS } from '../models/sos.model.js';
import { User } from '../models/user.model.js';
import { updateUserLocation, removeUserLocation } from '../services/locationService.js';
import { findBestResponders } from '../services/dispatchService.js';
import { assignAmbulancesToSOS } from '../services/ambulanceDispatch.service.js';
import { SOS_STATUS } from '../constant.js';
import { withDistributedLock } from '../utils/distributedLock.js';
import { assertValidSOSTransition } from '../utils/stateMachine.js';

let ioInstance = null;

export const getIO = () => ioInstance;

export const emitSOSResolved = ({ sosId, resolvedAt, debrief, broadcasterId, responderIds = [] }) => {
  if (!ioInstance) return;
  const payload = { sosId, resolvedAt, debrief };
  ioInstance.to(`sos:${sosId}`).emit('sos_resolved', payload);
  if (broadcasterId) ioInstance.to(broadcasterId.toString()).emit('sos_resolved', payload);
  responderIds.forEach(id => ioInstance.to(id.toString()).emit('sos_resolved', payload));
};

export const emitSOSEnriched = ({ sosId, aiGuidance, emergencySummary, broadcasterId }) => {
  if (!ioInstance) return;
  const payload = { sosId, aiGuidance, emergencySummary };
  ioInstance.to(`sos:${sosId}`).emit('sos_enriched', payload);
  if (broadcasterId) ioInstance.to(broadcasterId.toString()).emit('sos_enriched', payload);
};

const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean);

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    }
  });

  try {
    const pubClient = createNewRedisClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.io] Distributed Redis adapter attached successfully');
  } catch (err) {
    console.warn('[Socket.io] Redis adapter initialization skipped:', err.message);
  }

  ioInstance = io;

  io.use((socket, next) => {
    let token = socket.handshake.auth.token;
    if (!token && socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      token = cookies.accessToken;
    }
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "access-token-secret");
      socket.userId = decoded._id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.userId}`);
    socket.join(socket.userId);

    socket.on('join_sos', async ({ sosId }) => {
      try {
        const sos = await SOS.findById(sosId);
        if (!sos) { socket.emit('error', { message: 'SOS not found' }); return; }
        const isBroadcaster = sos.broadcaster.toString() === socket.userId;
        const isResponder = sos.responders.some(e => e.user.toString() === socket.userId);
        if (!isBroadcaster && !isResponder) { socket.emit('error', { message: 'Not authorized' }); return; }
        socket.join(`sos:${sosId}`);
        if (isBroadcaster) for (const entry of sos.responders) socket.join(`sos:${sosId}:responder:${entry.user.toString()}`);
        if (isResponder) { socket.join(`sos:${sosId}:responder:${socket.userId}`); io.to(sos.broadcaster.toString()).socketsJoin(`sos:${sosId}:responder:${socket.userId}`); }
      } catch { socket.emit('error', { message: 'Failed to join SOS room' }); }
    });

    // High-Frequency GPS Stream Throttle (Leaky Bucket pattern: max 1 update per 2 seconds)
    const LOCATION_THROTTLE_MS = 2000;
    socket.on('update_location', async ({ longitude, latitude }) => {
      const now = Date.now();
      if (socket.lastLocationUpdate && (now - socket.lastLocationUpdate < LOCATION_THROTTLE_MS)) {
        // Acknowledge without hammering Redis GEOADD
        socket.emit('location_updated', { success: true, throttled: true });
        return;
      }
      socket.lastLocationUpdate = now;

      try {
        await updateUserLocation(socket.userId, longitude, latitude);
        socket.emit('location_updated', { success: true, throttled: false });
      } catch {
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    socket.on('broadcast_sos', async ({ sosId }) => {
      try {
        const sos = await SOS.findById(sosId).populate('broadcaster', 'name phone avatar');
        if (!sos) return;
        const broadcasterUser = await User.findById(sos.broadcaster._id).populate('guardians', '_id name');
        const guardianIds = (broadcasterUser?.guardians || []).map(g => g._id.toString());
        const [longitude, latitude] = sos.location.coordinates;
        const responders = await findBestResponders(longitude, latitude, sos.crisisType, sos.broadcastRadius);
        const assignedAmbulances = await assignAmbulancesToSOS(sos._id, latitude, longitude, 2);
        if (responders.length === 0 && guardianIds.length === 0 && assignedAmbulances.length === 0) { socket.emit('no_responders_found'); return; }
        const sosAlertPayload = (responder) => ({ sosId: sos._id, crisisType: sos.crisisType, location: sos.location, address: sos.address, broadcaster: sos.isAnonymous ? null : sos.broadcaster, eta: responder?.eta || null, distance: responder?.distance || null });
        if (guardianIds.length > 0) {
          guardianIds.forEach(gId => {
            if (gId === sos.broadcaster._id.toString()) return;
            io.to(gId).emit('guardian_sos_alert', { ...sosAlertPayload(), isGuardianAlert: true, wardName: broadcasterUser.name });
            io.to(gId).emit('sos_alert', { ...sosAlertPayload(), isGuardianAlert: true, wardName: broadcasterUser.name });
          });
          sos.guardianNotified = true;
          await sos.save();
          setTimeout(async () => {
            responders.forEach(r => {
              if (r.userId.toString() === sos.broadcaster._id.toString()) return;
              if (guardianIds.includes(r.userId.toString())) return;
              io.to(r.userId.toString()).emit('sos_alert', sosAlertPayload(r));
            });
          }, 15000);
          socket.emit('guardians_notified', { count: guardianIds.length, message: `${guardianIds.length} guardian(s) notified first. Community alerted in 15s.` });
        } else {
          responders.forEach(r => {
            if (r.userId.toString() === sos.broadcaster._id.toString()) return;
            io.to(r.userId.toString()).emit('sos_alert', sosAlertPayload(r));
          });
        }

        if (assignedAmbulances.length > 0) {
          io.to(sos.broadcaster._id.toString()).emit('ambulance_dispatched', { sosId: sos._id, ambulances: assignedAmbulances });
          io.to(`sos:${sosId}`).emit('ambulance_dispatched', { sosId: sos._id, ambulances: assignedAmbulances });
          socket.emit('ambulance_dispatched', { sosId: sos._id, ambulances: assignedAmbulances });
        }

        setTimeout(async () => {
          const updated = await SOS.findById(sosId);
          if (updated.status === SOS_STATUS.ACTIVE && updated.responders.length === 0) socket.emit('expanding_search');
        }, 30000);
      } catch { socket.emit('error', { message: 'Failed to broadcast SOS' }); }
    });

    socket.on('accept_sos', async ({ sosId }) => {
      const lockKey = `sos:accept:${sosId}`;
      try {
        await withDistributedLock(lockKey, 4000, async () => {
          // Prevent a responder from accepting multiple active SOS simultaneously.
          const existingAssignment = await SOS.findOne({
            status: { $in: [SOS_STATUS.ACTIVE, SOS_STATUS.RESPONDING] },
            'responders.user': socket.userId
          }).select('_id status');

          if (existingAssignment) {
            socket.emit('error', { message: 'You are already responding to an active SOS.' });
            return;
          }

          const currentSOS = await SOS.findById(sosId);
          if (!currentSOS) {
            socket.emit('error', { message: 'SOS not found' });
            return;
          }

          // Strict Finite State Machine validation
          try {
            assertValidSOSTransition(currentSOS.status, SOS_STATUS.RESPONDING, sosId);
          } catch (stateErr) {
            socket.emit('sos_already_taken', { sosId, message: stateErr.message });
            return;
          }

          // Atomic accept: only one responder can ever transition an SOS from ACTIVE -> RESPONDING.
          const acceptedAt = new Date();
          const updated = await SOS.findOneAndUpdate(
            {
              _id: sosId,
              status: SOS_STATUS.ACTIVE,
              'responders.0': { $exists: false }
            },
            {
              $push: { responders: { user: socket.userId, acceptedAt } },
              $set: { status: SOS_STATUS.RESPONDING }
            },
            { new: true }
          );

          if (!updated) {
            const current = await SOS.findById(sosId).select('status responders');
            if (!current) {
              socket.emit('error', { message: 'SOS not found' });
              return;
            }
            if (current.responders?.some(e => e.user.toString() === socket.userId)) {
              socket.emit('sos_accepted', { sosId: current._id, alreadyAccepted: true });
              return;
            }
            socket.emit('sos_already_taken', { sosId });
            return;
          }

          // Backfill timeToAcceptance once (best-effort).
          if (!updated.timeToAcceptance) {
            updated.timeToAcceptance = (Date.now() - new Date(updated.createdAt).getTime()) / 1000;
            await updated.save();
          }

          const populatedSOS = await SOS.findById(sosId).populate('broadcaster', 'name phone avatar').populate('responders.user', 'name phone avatar skills trustScore');
          const responderUser = await User.findById(socket.userId).select('name avatar skills trustScore');
          socket.join(`sos:${sosId}`);
          io.to(updated.broadcaster.toString()).socketsJoin(`sos:${sosId}`);
          const responderRoom = `sos:${sosId}:responder:${socket.userId}`;
          socket.join(responderRoom);
          io.to(updated.broadcaster.toString()).socketsJoin(responderRoom);
          io.to(updated.broadcaster.toString()).emit('responder_accepted', { sosId: updated._id, responder: populatedSOS.responders[populatedSOS.responders.length - 1], responderMeta: responderUser });
          io.to(`sos:${sosId}`).emit('sos_state_updated', { sosId: updated._id, status: populatedSOS.status, responders: populatedSOS.responders });
          io.to(updated.broadcaster.toString()).emit('sos_state_updated', { sosId: updated._id, status: populatedSOS.status, responders: populatedSOS.responders });
          const sosPayload = populatedSOS.toObject();
          if (sosPayload.isAnonymous && sosPayload.broadcaster?._id?.toString() !== socket.userId) sosPayload.broadcaster = null;
          
          // Emit to responder
          socket.emit('sos_accepted', { sos: sosPayload });
          
          // Emit to broadcaster so they also get redirected
          io.to(updated.broadcaster.toString()).emit('sos_accepted', { sos: sosPayload });
        });
      } catch (err) {
        if (err.isLockContention) {
          socket.emit('sos_already_taken', { sosId, message: 'Another responder is currently accepting this SOS.' });
          return;
        }
        socket.emit('error', { message: 'Failed to accept SOS' });
      }
    });

    socket.on('send_message', ({ sosId, responderId, message }) => {
      const room = responderId ? `sos:${sosId}:responder:${responderId}` : `sos:${sosId}`;
      io.to(room).emit('new_message', { sosId, responderId: responderId || null, senderId: socket.userId, message, timestamp: new Date() });
    });

    socket.on('share_live_location', ({ sosId, responderId, longitude, latitude }) => {
      const room = responderId ? `sos:${sosId}:responder:${responderId}` : `sos:${sosId}`;
      io.to(room).emit('live_location_update', { sosId, responderId: responderId || socket.userId, userId: socket.userId, longitude, latitude, timestamp: new Date() });
    });

    socket.on('disconnect', async () => {
      console.log(`[SOCKET] User disconnected: ${socket.userId}`);
      await removeUserLocation(socket.userId);
    });
  });

  return io;
};
