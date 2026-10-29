import test from 'node:test';
import assert from 'node:assert/strict';
import type { Context } from '@netlify/functions';
import { config as reviewConfig } from '../netlify/functions/resume-review';
import webhook, { config as webhookConfig } from '../netlify/functions/resume-webhook';

test('public intake webhook is excluded from the authenticated review route', () => {
  const exclusions: (string | undefined)[] = [reviewConfig.excludedPath].flat();
  assert.ok(exclusions.includes(webhookConfig.path as string));
  assert.equal(reviewConfig.path, '/api/resume-intake/:action');
});

test('unsigned intake reaches signature verification without a workspace session', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Netlify');
  Object.defineProperty(globalThis, 'Netlify', {
    configurable: true,
    value: { env: { get: (key: string) => ({
      RESEND_API_KEY: 're_test_not_a_real_key',
      RESEND_WEBHOOK_SECRET: 'whsec_dGVzdA==',
    }[key]) } },
  });
  try {
    const response = await webhook(new Request('https://example.test/api/resume-intake/webhook', {
      method: 'POST', body: '{}',
    }), {} as Context);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid signature.' });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Netlify', previous);
    else Reflect.deleteProperty(globalThis, 'Netlify');
  }
});
