import { describe, expect, it } from 'vitest';
import { allManagementLaunchChecksPass, managementLaunchChecks } from './launch-readiness';

const configured = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  MANAGE_ORIGIN: 'https://manage.onesimplesite.co.uk',
  PORTAL_ORIGIN: 'https://portal.onesimplesite.co.uk',
  BETTER_AUTH_SECRET: 'a'.repeat(40),
  RESEND_API_KEY: 're_qwertyuiopasdfghjklzxcvbnm',
  STRIPE_SECRET_KEY: ['sk', 'live', 'qwertyuiopasdfghjklzxcvbnm'].join('_'),
  STRIPE_WEBHOOK_SECRET: 'whsec_qwertyuiopasdfghjklzxcvbnm',
  CRON_SECRET: 'c'.repeat(40),
} as NodeJS.ProcessEnv;

describe('managementLaunchChecks', () => {
  it('fails closed and reports booleans only when configuration is absent', () => {
    expect(managementLaunchChecks({} as NodeJS.ProcessEnv)).toEqual({
      productionMode: false,
      manageOrigin: false,
      portalOrigin: false,
      authSecret: false,
      emailDelivery: false,
      stripeSecret: false,
      stripeWebhook: false,
      scheduledJobs: false,
    });
  });

  it('passes a complete production configuration and rejects placeholders', () => {
    expect(allManagementLaunchChecksPass(managementLaunchChecks(configured))).toBe(true);
    expect(allManagementLaunchChecksPass(managementLaunchChecks({ ...configured, RESEND_API_KEY: 're_placeholder_key_for_testing' }))).toBe(false);
  });
});
