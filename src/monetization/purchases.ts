// RevenueCat wrapper. Native-only: on web, in Expo Go, or with no API key
// configured, every call degrades to the free-preview behavior so the app
// keeps working everywhere. The real SDK activates in the dev/store build
// once the API key lands in app.json extra.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const FREE_ROUNDS = 3;
export const PRO_ENTITLEMENT = 'spar_pro';

export type PlanInfo = {
  identifier: string;
  priceString: string;
  pkg: unknown;
};

export type OfferingInfo = {
  yearly?: PlanInfo;
  monthly?: PlanInfo;
};

let purchasesModule: any = null;
let configured = false;

function native(): any {
  if (Platform.OS === 'web') return null;
  if (purchasesModule) return purchasesModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchasesModule = require('react-native-purchases').default;
  } catch {
    purchasesModule = null;
  }
  return purchasesModule;
}

export function configurePurchases(): boolean {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  // TODO(galaxy): when the Samsung seller account is live, switch to the
  // Galaxy Store configuration per RevenueCat's RN docs (SDK >= 10.3).
  const apiKey = extra.revenueCatApiKey;
  const Purchases = native();
  if (!Purchases || !apiKey) return false;
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function isConfigured(): boolean {
  return configured;
}

export async function isPro(): Promise<boolean> {
  const Purchases = native();
  if (!Purchases || !configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info?.entitlements?.active?.[PRO_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}

export async function getOffering(): Promise<OfferingInfo | null> {
  const Purchases = native();
  if (!Purchases || !configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    if (!current) return null;
    const toPlan = (pkg: any): PlanInfo | undefined =>
      pkg
        ? {
            identifier: pkg.identifier,
            priceString: pkg.product?.priceString ?? '',
            pkg,
          }
        : undefined;
    return { yearly: toPlan(current.annual), monthly: toPlan(current.monthly) };
  } catch {
    return null;
  }
}

export async function purchase(plan: PlanInfo): Promise<boolean> {
  const Purchases = native();
  if (!Purchases || !configured) return false;
  try {
    const result = await Purchases.purchasePackage(plan.pkg);
    return result?.customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}

export async function restore(): Promise<boolean> {
  const Purchases = native();
  if (!Purchases || !configured) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info?.entitlements?.active?.[PRO_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}
