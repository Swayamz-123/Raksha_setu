import { describe, it, expect } from 'vitest';
import { isValidSOSTransition, assertValidSOSTransition } from '../src/utils/stateMachine.js';
import { SOS_STATUS } from '../src/constant.js';

describe('Emergency Finite State Machine (FSM)', () => {
  it('allows valid forward transitions from ACTIVE', () => {
    expect(isValidSOSTransition(SOS_STATUS.ACTIVE, SOS_STATUS.RESPONDING)).toBe(true);
    expect(isValidSOSTransition(SOS_STATUS.ACTIVE, SOS_STATUS.RESOLVED)).toBe(true);
    expect(isValidSOSTransition(SOS_STATUS.ACTIVE, SOS_STATUS.CANCELLED)).toBe(true);
  });

  it('allows valid forward transitions from RESPONDING', () => {
    expect(isValidSOSTransition(SOS_STATUS.RESPONDING, SOS_STATUS.RESOLVED)).toBe(true);
    expect(isValidSOSTransition(SOS_STATUS.RESPONDING, SOS_STATUS.CANCELLED)).toBe(true);
  });

  it('prohibits backwards transitions from RESOLVED or CANCELLED', () => {
    expect(isValidSOSTransition(SOS_STATUS.RESOLVED, SOS_STATUS.ACTIVE)).toBe(false);
    expect(isValidSOSTransition(SOS_STATUS.RESOLVED, SOS_STATUS.RESPONDING)).toBe(false);
    expect(isValidSOSTransition(SOS_STATUS.CANCELLED, SOS_STATUS.ACTIVE)).toBe(false);
    expect(isValidSOSTransition(SOS_STATUS.CANCELLED, SOS_STATUS.RESPONDING)).toBe(false);
  });

  it('throws an ApiError on illegal transitions when assertValidSOSTransition is called', () => {
    expect(() => {
      assertValidSOSTransition(SOS_STATUS.RESOLVED, SOS_STATUS.ACTIVE, 'sos-123');
    }).toThrowError(/Illegal SOS state transition/);
  });

  it('treats identical state transition as idempotent no-op', () => {
    expect(isValidSOSTransition(SOS_STATUS.ACTIVE, SOS_STATUS.ACTIVE)).toBe(true);
    expect(isValidSOSTransition(SOS_STATUS.RESOLVED, SOS_STATUS.RESOLVED)).toBe(true);
  });
});
