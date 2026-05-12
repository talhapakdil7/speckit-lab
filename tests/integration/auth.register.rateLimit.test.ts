import type { Express } from 'express';
import { buildTestApp, type TestAgent } from './helpers/testApp';
import { closeTestPool } from './helpers/testDb';

let app: Express;
let agent: TestAgent;

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(40);
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://auth:auth@localhost:5432/auth_test';
  process.env.PUBLIC_URL = 'http://localhost:3000';
  process.env.BCRYPT_COST = '4';
  process.env.RATE_LIMIT_REGISTER_PER_IP_PER_HOUR = '10';
  ({ app, agent } = await buildTestApp());
});

afterAll(async () => {
  await closeTestPool();
});

describe('POST /auth/register rate limit (US1, FR-016)', () => {
  it('returns 429 with Retry-After after the configured per-IP threshold', async () => {
    // 10 attempts allowed per IP per hour. The 11th must be limited.
    for (let i = 0; i < 10; i++) {
      const res = await agent.post('/auth/register').send({
        email: `user${i}@example.com`,
        password: 'correcthorse9',
      });
      // Accept 201 (success) or 409 (dup); we only care that none are 429 yet.
      expect([201, 409]).toContain(res.status);
    }

    const limited = await agent.post('/auth/register').send({
      email: 'overflow@example.com',
      password: 'correcthorse9',
    });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers['retry-after']).toBeDefined();
  });
});
