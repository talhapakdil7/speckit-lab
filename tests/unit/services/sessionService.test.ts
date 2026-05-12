import {
  startSession,
  revokeSession,
  revokeAllSessionsForUser,
} from '../../../src/services/sessionService';
import { SESSION_LIFETIME_MS } from '../../../src/services/tokenService';

/**
 * Unit tests for sessionService. Verifies the 24-hour expiry (FR-008),
 * single-session revocation (FR-009), and user-wide revocation
 * (FR-015). Repositories and token issuance are mocked at the module
 * seam so the service is exercised against fakes (constitution §6).
 */

jest.mock('../../../src/services/tokenService', () => ({
  // 24h in ms — must match the production constant for the expiry assertion.
  SESSION_LIFETIME_MS: 24 * 60 * 60 * 1000,
  issueToken: jest.fn((input: { userId: string; jti: string }) => ({
    token: `jwt:${input.userId}:${input.jti}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })),
}));

jest.mock('../../../src/db/repositories/sessionsRepo', () => ({
  insertSession: jest.fn(async (input: unknown) => input),
  revokeByJti: jest.fn(async () => undefined),
  revokeAllForUser: jest.fn(async () => undefined),
}));

describe('sessionService', () => {
  const FIXED_NOW = new Date('2026-05-12T00:00:00.000Z').getTime();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startSession', () => {
    it('should persist a session whose expires_at is exactly 24h after issued_at (FR-008)', async () => {
      const sessionsRepo = jest.requireMock('../../../src/db/repositories/sessionsRepo') as {
        insertSession: jest.Mock;
      };
      await startSession('user-1');

      expect(sessionsRepo.insertSession).toHaveBeenCalledTimes(1);
      const arg = sessionsRepo.insertSession.mock.calls[0][0] as {
        jti: string;
        userId: string;
        issuedAt: Date;
        expiresAt: Date;
      };
      expect(arg.userId).toBe('user-1');
      expect(arg.jti).toEqual(expect.any(String));
      const diff = arg.expiresAt.getTime() - arg.issuedAt.getTime();
      expect(diff).toBe(SESSION_LIFETIME_MS);
    });

    it('should return an encoded token bound to the persisted jti', async () => {
      const sessionsRepo = jest.requireMock('../../../src/db/repositories/sessionsRepo') as {
        insertSession: jest.Mock;
      };
      const result = await startSession('user-1');
      const persistedJti = (sessionsRepo.insertSession.mock.calls[0][0] as { jti: string }).jti;
      expect(result.token).toContain(persistedJti);
    });
  });

  describe('revokeSession', () => {
    it("should call repo.revokeByJti with reason 'logout' by default (FR-009)", async () => {
      const sessionsRepo = jest.requireMock('../../../src/db/repositories/sessionsRepo') as {
        revokeByJti: jest.Mock;
      };
      await revokeSession('jti-1');
      expect(sessionsRepo.revokeByJti).toHaveBeenCalledWith('jti-1', 'logout');
    });
  });

  describe('revokeAllSessionsForUser', () => {
    it("should call repo.revokeAllForUser with reason 'password_change' by default (FR-015)", async () => {
      const sessionsRepo = jest.requireMock('../../../src/db/repositories/sessionsRepo') as {
        revokeAllForUser: jest.Mock;
      };
      await revokeAllSessionsForUser('user-1');
      expect(sessionsRepo.revokeAllForUser).toHaveBeenCalledWith('user-1', 'password_change');
    });
  });
});
