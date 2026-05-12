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
  ({ app, agent } = await buildTestApp());
});

afterAll(async () => {
  await closeTestPool();
});

describe('POST /auth/register (US1)', () => {
  it('Scenario 1: registers a fresh email and returns a usable session token', async () => {
    const res = await agent
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'correcthorse9' });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.expiresAt).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'alice@example.com',
    });

    const me = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('alice@example.com');
  });

  it('Scenario 2: rejects duplicate registration with 409 email_taken', async () => {
    await agent
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'correcthorse9' });
    const res = await agent
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'correcthorse9' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it('Scenario 2 (case-insensitive duplicate): same email different casing also rejected', async () => {
    await agent
      .post('/auth/register')
      .send({ email: 'carol@example.com', password: 'correcthorse9' });
    const res = await agent
      .post('/auth/register')
      .send({ email: '  CAROL@Example.com ', password: 'correcthorse9' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it('Scenario 3: rejects weak password with 400 validation_failed', async () => {
    const res = await agent
      .post('/auth/register')
      .send({ email: 'dan@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('Scenario 3 (no non-alpha): rejects all-letter passwords', async () => {
    const res = await agent
      .post('/auth/register')
      .send({ email: 'eve@example.com', password: 'allletters' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('Scenario 4: rejects malformed email with 400 validation_failed', async () => {
    const res = await agent
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'correcthorse9' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});
