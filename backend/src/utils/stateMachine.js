import { SOS_STATUS } from '../constant.js';
import { ApiError } from './ApiError.js';

export const SOS_STATE_TRANSITIONS = {
  [SOS_STATUS.ACTIVE]: [SOS_STATUS.RESPONDING, SOS_STATUS.CANCELLED, SOS_STATUS.RESOLVED],
  [SOS_STATUS.RESPONDING]: [SOS_STATUS.RESOLVED, SOS_STATUS.CANCELLED],
  [SOS_STATUS.RESOLVED]: [], // Terminal state
  [SOS_STATUS.CANCELLED]: [] // Terminal state
};

/**
 * Checks if a state transition is permitted
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
export const isValidSOSTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) return true; // Idempotent no-op
  const allowed = SOS_STATE_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(nextStatus));
};

/**
 * Asserts a valid transition, throwing a 400 ApiError if invalid
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @param {string} sosId
 */
export const assertValidSOSTransition = (currentStatus, nextStatus, sosId = '') => {
  if (!isValidSOSTransition(currentStatus, nextStatus)) {
    throw new ApiError(
      400,
      `Illegal SOS state transition: cannot transition SOS ${sosId ? `'${sosId}' ` : ''}from '${currentStatus}' to '${nextStatus}'. Terminal states: [${SOS_STATUS.RESOLVED}, ${SOS_STATUS.CANCELLED}].`
    );
  }
};
