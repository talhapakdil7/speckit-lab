import {
  insertSession,
  findActiveByJti,
  revokeByJti,
  revokeAllForUser,
} from '../../../../src/db/repositories/sessionsRepo';

/**
 * Unit tests for `sessionsRepo`. The `pg` Pool is replaced at the
 * module seam so the repository's SQL contract, row → domain mapping,
 * and error path can be exercised without a live database.
 */

const queryMock = jest.fn();

jest.mock('../../../../src/db/pool', () => ({
  getPool: () => ({ query: queryMock }),
}));

const SAMPLE_ROW = {
  jti: 'j-1',
  user_id: 'u-1',
  issued_at: new Date('2026-05-12T00:00:00Z'),
  expires_at: new Date('2026-05-13T00:00:00Z'),
  revoked_at: null,
  revoked_reason: null,
};

describe('sessionsRepo', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('insertSession', () => {
    it('should map the inserted row into the domain shape', async () => {
      queryMock.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
      const s = await insertSession({
        jti: 'j-1',
        userId: 'u-1',
        issuedAt: SAMPLE_ROW.issued_at,
        expiresAt: SAMPLE_ROW.expires_at,
      });
      expect(s).toEqual({
        jti: 'j-1',
        userId: 'u-1',
        issuedAt: SAMPLE_ROW.issued_at,
        expiresAt: SAMPLE_ROW.expires_at,
        revokedAt: null,
        revokedReason: null,
      });
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/INSERT INTO sessions/i);
      expect(params).toEqual(['j-1', 'u-1', SAMPLE_ROW.issued_at, SAMPLE_ROW.expires_at]);
    });

    it('should throw when the INSERT returns no row', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await expect(
        insertSession({
          jti: 'j-1',
          userId: 'u-1',
          issuedAt: SAMPLE_ROW.issued_at,
          expiresAt: SAMPLE_ROW.expires_at,
        }),
      ).rejects.toThrow(/no row/i);
    });
  });

  describe('findActiveByJti', () => {
    it('should return the mapped session when an active row exists', async () => {
      queryMock.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
      const s = await findActiveByJti('j-1');
      expect(s?.jti).toBe('j-1');
      expect(s?.userId).toBe('u-1');
    });

    it('should return null when no active row matches', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      const s = await findActiveByJti('j-missing');
      expect(s).toBeNull();
    });
  });

  describe('revokeByJti', () => {
    it('should run an UPDATE that sets revoked_at and revoked_reason for the jti', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await revokeByJti('j-1', 'logout');
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/UPDATE sessions SET revoked_at = now\(\)/i);
      expect(params).toEqual(['j-1', 'logout']);
    });
  });

  describe('revokeAllForUser', () => {
    it('should run an UPDATE for every active session of the user', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await revokeAllForUser('u-1', 'password_change');
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/WHERE user_id = \$1 AND revoked_at IS NULL/i);
      expect(params).toEqual(['u-1', 'password_change']);
    });
  });
});
