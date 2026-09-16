// The only place that talks to the OneSignal SDK.
//
// Native-only: the module is lazily required behind a Platform check so the web
// preview (and every headless QA run) never touches the native TurboModule.
// Everything here is a no-op when the SDK is absent, so callers never branch.
//
// Push permission is deliberately NOT requested at init — we ask at the moment
// the user schedules a real conversation, which is when a reminder means something.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const INSTALL_ID_KEY = 'spar.installId.v1';

type ClickTarget = { screen?: string };

let sdk: any = null;
let initialized = false;
let onDeepLink: ((target: ClickTarget) => void) | null = null;

function native(): any {
  if (Platform.OS === 'web') return null;
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = require('react-native-onesignal');
  } catch {
    sdk = null;
  }
  return sdk;
}

function appId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const id = extra.oneSignalAppId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** A stable id for this install, so OneSignal and RevenueCat describe the same person. */
export async function installId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (saved) return saved;
  } catch {
    // fall through and mint a new one
  }
  const minted = `spar_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    await AsyncStorage.setItem(INSTALL_ID_KEY, minted);
  } catch {
    // best effort; a fresh id next launch is survivable
  }
  return minted;
}

/**
 * Starts OneSignal and identifies this install. `handleDeepLink` runs when a
 * notification is tapped, including from cold start.
 */
export async function initOneSignal(handleDeepLink: (target: ClickTarget) => void): Promise<boolean> {
  const mod = native();
  const id = appId();
  if (!mod || !id || initialized) return false;

  const { OneSignal, LogLevel } = mod;
  try {
    if (__DEV__) OneSignal.Debug.setLogLevel(LogLevel.Warn);
    OneSignal.initialize(id);
    onDeepLink = handleDeepLink;

    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const data = (event?.notification?.additionalData ?? {}) as ClickTarget;
      onDeepLink?.(data);
    });

    // Identify before tagging so the tags land on the right user.
    OneSignal.login(await installId());

    // RevenueCat needs the OneSignal id to forward subscription events as tags.
    // It can be null until registration completes, so also watch for it changing.
    OneSignal.User.addEventListener('change', (state: any) => {
      const onesignalId = state?.current?.onesignalId;
      if (onesignalId) linkToRevenueCat(onesignalId);
    });
    const existing = await OneSignal.User.getOnesignalId();
    if (existing) linkToRevenueCat(existing);

    initialized = true;
    return true;
  } catch {
    initialized = false;
    return false;
  }
}

/** Hands the OneSignal id to RevenueCat so its subscription events become tags. */
function linkToRevenueCat(onesignalId: string): void {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    Purchases?.setOnesignalUserID?.(onesignalId)?.catch?.(() => undefined);
  } catch {
    // RevenueCat not configured in this build
  }
}

/** Asks for push permission, falling back to the system settings screen. */
export async function requestPushPermission(): Promise<boolean> {
  const mod = native();
  if (!mod || !initialized) return false;
  try {
    return await mod.OneSignal.Notifications.requestPermission(true);
  } catch {
    return false;
  }
}

/** Tag values must be strings; numbers and booleans are converted here. */
export function setTags(tags: Record<string, string | number | boolean | null | undefined>): void {
  const mod = native();
  if (!mod || !initialized) return;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value === null || value === undefined || value === '') continue;
    clean[key] = String(value);
  }
  if (Object.keys(clean).length === 0) return;
  try {
    mod.OneSignal.User.addTags(clean);
  } catch {
    // tagging is best effort
  }
}

export function clearTags(keys: string[]): void {
  const mod = native();
  if (!mod || !initialized) return;
  try {
    mod.OneSignal.User.removeTags(keys);
  } catch {
    // best effort
  }
}

/** In-app message triggers, for messages that should fire on a moment in the app. */
export function setTrigger(key: string, value: string): void {
  const mod = native();
  if (!mod || !initialized) return;
  try {
    mod.OneSignal.InAppMessages.addTrigger(key, value);
  } catch {
    // best effort
  }
}
