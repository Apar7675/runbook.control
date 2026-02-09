import Stripe from "stripe";

let _stripe: Stripe | null = null;
let _logged = false;

export function getStripe() {
  if (_stripe) return _stripe;

  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  // IMPORTANT: do NOT set an invalid apiVersion string.
  _stripe = new Stripe(key);

  // Optional one-time log (safe): helps diagnose "wrong Stripe account" mismatches.
  if (!_logged) {
    _logged = true;
    const last6 = key.slice(-6);
    console.log(`[stripe] initialized (key last6=${last6})`);
  }

  return _stripe;
}

export function requireStripeEnv() {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return true;
}

export function requireWebhookSecret() {
  const whsec = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!whsec) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return whsec;
}
