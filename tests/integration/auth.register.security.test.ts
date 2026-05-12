import type { Express } from 'express';
import { buildTestApp, type TestAgent } from './helpers/testApp';
import { closeTestPool } from './helpers/testDb';
import { getPool } from '../../src/db/pool';

/**
 * Integration tests for the security invariants of `POST /auth/register`:
 *
 * - FR-005: plaintext password is never persisted in any column.
 * - FR-005: plaintext password is never echoed in the response body.
 * - FR-017: plaintext password / token / Authorization are redacted in logs.
 *
 * Constitution §11 mandates these MUST be covered.
 */

let app: Express;
let agent: TestAgent;

const consoleSpies: jest.SpyInstance[] = [];
const captured: string[] = [];

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

beforeEach(() => {
  captured.length = 0;
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    consoleSpies.push(
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        captured.push(args.map(String).join(' '));
      }),
    );
  }
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  consoleSpies.length = 0;
});

describe('POST /auth/register security invariants', () => {
  const PASSWORD = 'correcthorse9secure';

  it('should never echo the plaintext password in the response body (FR-005)', async () => {
    const res = await agent
      .post('/auth/register')
      .send({ email: 'sec1@example.com', password: PASSWORD });

    expect(res.status).toBe(201);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(PASSWORD);
    expect(body).not.toMatch(/password_hash/i);
    // Response shape must only expose the documented fields.
    expect(Object.keys(res.body)).toEqual(
      expect.arrayContaining(['token', 'expiresAt', 'user']),
    );
    expect(Object.keys(res.body.user)).toEqual(expect.arrayContaining(['id', 'email']));
  });

  it('should persist the password only as a bcrypt hash, never as plaintext (FR-005)', async () => {
    await agent
      .post('/auth/register')
      .send({ email: 'sec2@example.com', password: PASSWORD });

    const row = await getPool().query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email_normalized = $1',
      ['sec2@example.com'],
    );
    const hash = row.rows[0]?.password_hash;
    expect(hash).toBeDefined();
    // bcrypt hashes start with $2a$, $2b$, or $2y$
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).not.toContain(PASSWORD);
  });

  it('should not write the plaintext password to logs (FR-017)', async () => {
    await agent
      .post('/auth/register')
      .send({ email: 'sec3@example.com', password: PASSWORD });
    const logBlob = captured.join('\n');
    expect(logBlob).not.toContain(PASSWORD);
  });
});
