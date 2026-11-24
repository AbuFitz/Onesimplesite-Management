import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

const previousPortalOrigin = process.env.PORTAL_ORIGIN;

afterEach(() => {
  if (previousPortalOrigin === undefined) delete process.env.PORTAL_ORIGIN;
  else process.env.PORTAL_ORIGIN = previousPortalOrigin;
});

describe('portal host routing', () => {
  it('serves the launch readiness probe without rewriting it into the portal UI', () => {
    process.env.PORTAL_ORIGIN = 'https://portal.onesimplesite.co.uk';
    const request = new NextRequest('https://portal.onesimplesite.co.uk/api/launch-ready');
    const response = proxy(request);

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
