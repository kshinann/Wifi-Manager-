/**
 * Placeholder hooks for ads and in-app purchases.
 *
 * Swap these bodies for a real SDK later (e.g. react-native-google-mobile-ads for rewarded
 * ads, react-native-iap / RevenueCat for purchases). The rest of the game only talks to
 * this module, so nothing else needs to change.
 */
export type ProductId = 'hints_pack_10' | 'remove_ads' | 'starter_bundle';

export const PRODUCTS: { id: ProductId; title: string; price: string }[] = [
  { id: 'hints_pack_10', title: '10 Hints', price: '$0.99' },
  { id: 'starter_bundle', title: 'Starter Bundle (15 hints + 5 undos)', price: '$1.99' },
  { id: 'remove_ads', title: 'Remove Ads', price: '$2.99' },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Shows a rewarded ad. Resolves true if the player watched it to the end. */
export async function showRewardedAd(_placement: 'extra_hint' | 'extra_undo' | 'continue'): Promise<boolean> {
  await delay(600); // TODO: integrate ad SDK
  return true;
}

/** Shows an interstitial between levels (no-op placeholder). */
export async function maybeShowInterstitial(_levelsCompleted: number): Promise<void> {
  // TODO: integrate ad SDK; respect "remove_ads" entitlement.
}

/** Starts a purchase. Resolves true on success. */
export async function purchase(_id: ProductId): Promise<boolean> {
  await delay(600); // TODO: integrate store SDK
  return false;
}
