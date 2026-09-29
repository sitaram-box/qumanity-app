/**
 * Qumanity Cloud Functions. Phase 1: registration and PIN.
 * Later phases add: bootstrap, closeVoting, vote tallies, requests, elections,
 * notifications, revealId (see docs/DEVELOPMENT_PLAN.md §15).
 */

import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'asia-south1', maxInstances: 20 });

export { register } from './register';
export { pinStatus, setPin, verifyPin } from './pin';
