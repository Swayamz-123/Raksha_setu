import { Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { SOS_DISPATCH_QUEUE_NAME } from '../queues/sosQueue.js';
import { SOS } from '../models/sos.model.js';
import { User } from '../models/user.model.js';
import { Resource } from '../models/resource.model.js';
import { getIO, emitSOSEnriched } from '../socket/index.js';
import { findBestResponders } from '../services/dispatchService.js';
import { assignAmbulancesToSOS } from '../services/ambulanceDispatch.service.js';
import { generateCrisisGuidance, generateEmergencySummary } from '../utils/aiService.js';
import { sendSOSAlert, sendGuardianSOSAlertEmails } from '../services/emailAlertService.js';

let workerInstance = null;

export const startSOSWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    SOS_DISPATCH_QUEUE_NAME,
    async (job) => {
      const {
        sosId,
        broadcasterId,
        crisisType,
        latitude,
        longitude,
        address,
        broadcastRadius,
        isAnonymous
      } = job.data;

      const startTime = Date.now();
      console.log(`[SOS Worker] Processing job ${job.id} for SOS: ${sosId}`);

      // 1. Mark status as processing
      await SOS.findByIdAndUpdate(sosId, { dispatchStatus: 'processing' });

      // 2. Fetch Broadcaster and Guardian details
      const broadcaster = await User.findById(broadcasterId)
        .populate('guardians', '_id name email phone')
        .select('name phone medicalHistory guardians avatar');

      const guardianIds = (broadcaster?.guardians || []).map(g => g._id.toString());

      // 3. High-Priority Proximity Match (Responders & Ambulances)
      const [responders, assignedAmbulances, nearbyResources] = await Promise.all([
        findBestResponders(longitude, latitude, crisisType, broadcastRadius),
        assignAmbulancesToSOS(sosId, latitude, longitude, 2).catch(err => {
          console.error('[SOS Worker] Ambulance dispatch error:', err.message);
          return [];
        }),
        Resource.find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
              $maxDistance: 5000
            }
          },
          type: { $in: ['hospital', 'police_station', 'fire_station'] }
        }).limit(5).lean().catch(() => [])
      ]);

      // 4. Dispatch WebSocket events via Socket.io
      const io = getIO();
      if (io) {
        const sosAlertPayload = (responder) => ({
          sosId,
          crisisType,
          location: { type: 'Point', coordinates: [longitude, latitude] },
          address,
          broadcaster: isAnonymous ? null : { _id: broadcaster?._id, name: broadcaster?.name, avatar: broadcaster?.avatar },
          eta: responder?.eta || null,
          distance: responder?.distance || null
        });

        // A. Notify Guardians first
        if (guardianIds.length > 0) {
          guardianIds.forEach((gId) => {
            if (gId === broadcasterId.toString()) return;
            const payload = { ...sosAlertPayload(), isGuardianAlert: true, wardName: broadcaster?.name };
            io.to(gId).emit('guardian_sos_alert', payload);
            io.to(gId).emit('sos_alert', payload);
          });

          await SOS.findByIdAndUpdate(sosId, { guardianNotified: true });

          // Community alert fanout with staggered delay
          setTimeout(() => {
            responders.forEach((r) => {
              if (r.userId.toString() === broadcasterId.toString() || guardianIds.includes(r.userId.toString())) return;
              io.to(r.userId.toString()).emit('sos_alert', sosAlertPayload(r));
            });
          }, 15000);

          io.to(broadcasterId.toString()).emit('guardians_notified', {
            count: guardianIds.length,
            message: `${guardianIds.length} guardian(s) notified first. Community alerted in 15s.`
          });
        } else {
          // No guardians: Alert all nearby responders immediately
          responders.forEach((r) => {
            if (r.userId.toString() === broadcasterId.toString()) return;
            io.to(r.userId.toString()).emit('sos_alert', sosAlertPayload(r));
          });
        }

        // B. Emit Ambulance dispatch details
        if (assignedAmbulances.length > 0) {
          const ambulancePayload = { sosId, ambulances: assignedAmbulances };
          io.to(broadcasterId.toString()).emit('ambulance_dispatched', ambulancePayload);
          io.to(`sos:${sosId}`).emit('ambulance_dispatched', ambulancePayload);
        }

        // C. Emit proximity completion to broadcaster
        io.to(broadcasterId.toString()).emit('sos_dispatched', {
          sosId,
          responderCount: responders.length,
          ambulanceCount: assignedAmbulances.length,
          nearbyResources
        });
      }

      // 5. Asynchronous AI Guidance Enrichment (Non-blocking)
      try {
        const [guidance, emergencySummary] = await Promise.all([
          generateCrisisGuidance(crisisType, address),
          generateEmergencySummary(crisisType, address, broadcastRadius)
        ]);

        await SOS.findByIdAndUpdate(sosId, {
          aiGuidance: guidance,
          emergencySummary,
          dispatchStatus: 'completed',
          workerEnrichedAt: new Date()
        });

        // Broadcast enriched AI advice to user's screen in real time
        emitSOSEnriched({
          sosId,
          aiGuidance: guidance,
          emergencySummary,
          broadcasterId
        });
        console.log(`[SOS Worker] AI Enrichment completed and broadcast for SOS: ${sosId}`);
      } catch (aiErr) {
        console.error('[SOS Worker] AI Enrichment failed:', aiErr.message);
        await SOS.findByIdAndUpdate(sosId, { dispatchStatus: 'completed' });
      }

      // 6. External Notifications (Email / SMS)
      const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
      sendSOSAlert({
        broadcasterName: broadcaster?.name,
        crisisType,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        mapsLink,
        medicalHistory: broadcaster?.medicalHistory
      }).catch(err => console.error('[SOS Worker] Service email alert failed:', err.message));

      sendGuardianSOSAlertEmails({
        guardians: broadcaster?.guardians || [],
        wardName: broadcaster?.name,
        crisisType,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        sosId: sosId.toString()
      }).catch(err => console.error('[SOS Worker] Guardian email alert failed:', err.message));

      const durationMs = Date.now() - startTime;
      console.log(`[SOS Worker] Successfully completed dispatch pipeline for SOS ${sosId} in ${durationMs}ms`);
      return { success: true, durationMs };
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5 // Process up to 5 concurrent emergency dispatches per worker
    }
  );

  workerInstance.on('completed', (job) => {
    console.log(`[BullMQ Worker] Job ${job.id} completed.`);
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] Job ${job?.id} failed with error:`, err.message);
  });

  console.log('[SOS Worker] BullMQ emergency dispatch worker initialized and listening.');
  return workerInstance;
};
