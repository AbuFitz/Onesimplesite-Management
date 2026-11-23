export interface ManagementLaunchChecks {
  productionMode: boolean;
  manageOrigin: boolean;
  portalOrigin: boolean;
  authSecret: boolean;
  emailDelivery: boolean;
  stripeSecret: boolean;
  stripeWebhook: boolean;
  scheduledJobs: boolean;
}

const real = (value: string, pattern: RegExp, minimumLength: number) =>
  value.length >= minimumLength && pattern.test(value) && !/(?:placeholder|change[-_ ]?me|replace|example|dummy|fake|todo)/i.test(value);

/** Static, secret-free checks. Database reachability is added by the route at request time. */
export function managementLaunchChecks(env: NodeJS.ProcessEnv = process.env): ManagementLaunchChecks {
  return {
    productionMode: env.APP_ENV === 'production',
    manageOrigin: env.MANAGE_ORIGIN === 'https://manage.onesimplesite.co.uk',
    portalOrigin: env.PORTAL_ORIGIN === 'https://portal.onesimplesite.co.uk',
    authSecret: real(env.BETTER_AUTH_SECRET || '', /^.+$/, 32),
    emailDelivery: real(env.RESEND_API_KEY || '', /^re_[A-Za-z0-9_-]+$/, 20),
    stripeSecret: real(env.STRIPE_SECRET_KEY || '', /^sk_(?:test|live)_[A-Za-z0-9_-]+$/, 24),
    stripeWebhook: real(env.STRIPE_WEBHOOK_SECRET || '', /^whsec_[A-Za-z0-9_-]+$/, 24),
    scheduledJobs: real(env.CRON_SECRET || '', /^.+$/, 32),
  };
}

export const allManagementLaunchChecksPass = (checks: ManagementLaunchChecks) => Object.values(checks).every(Boolean);
