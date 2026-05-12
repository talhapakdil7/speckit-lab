import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { migrateOnce, truncateAll } from './testDb';

/** Supertest agent type (avoids referencing a non-exported namespace). */
export type TestAgent = ReturnType<typeof request>;

/**
 * Build a fresh Express app instance and a bound supertest agent. Runs
 * migrations once and truncates between calls so each test starts clean.
 * @returns The agent and the app.
 */
export async function buildTestApp(): Promise<{
  app: Express;
  agent: TestAgent;
}> {
  await migrateOnce();
  await truncateAll();
  const app = createApp();
  return { app, agent: request(app) };
}
