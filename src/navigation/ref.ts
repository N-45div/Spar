// A navigation handle that lives outside React, so a tapped notification can
// open the right screen even when the tap is what launched the app.
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Queued until the navigator is ready — a cold start taps before React mounts. */
let pending: (() => void) | null = null;

export function runWhenReady(action: () => void): void {
  if (navigationRef.isReady()) {
    action();
    return;
  }
  pending = action;
}

export function flushPendingNavigation(): void {
  const action = pending;
  pending = null;
  if (action && navigationRef.isReady()) action();
}
