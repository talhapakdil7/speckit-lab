import {
  insertUser,
  findUserByEmail,
  updatePasswordHash,
  touchLastLogin,
} from '../../../../src/db/repositories/usersRepo';
import { EmailTakenError } from '../../../../src/lib/errors';

/**
 * Unit tests for `usersRepo`. The underlying `pg` Pool is replaced by a
 * stub at the module seam so we can exercise repository SQL contracts,
 * row→domain mapping, and the unique-violation translation (FR-004)
 * without a real database.
 */

const queryMock = jest.fn();

jest.mock('../../../../src/db/pool', () => ({
  getPool: () => ({ query: queryMock }),
}));

describe('usersRepo', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('insertUser', () => {
    it('should map the inserted row into the domain shape', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'u-1',
            email_normalized: 'alice@example.com',
            email_display: 'alice@example.com',
            password_hash: 'bcrypt$hash',
            created_at: new Date('2026-05-12T00:00:00Z'),
            last_login_at: null,
          },
        ],
      });

      const user = await insertUser({
        emailNormalized: 'alice@example.com',
        emailDisplay: 'alice@example.com',
        passwordHash: 'bcrypt$hash',
      });

      expect(user).toEqual({
        id: 'u-1',
        emailNormalized: 'alice@example.com',
        emailDisplay: 'alice@example.com',
        passwordHash: 'bcrypt$hash',
        createdAt: new Date('2026-05-12T00:00:00Z'),
        lastLoginAt: null,
      });
      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/INSERT INTO users/i);
      expect(params).toEqual(['alice@example.com', 'alice@example.com', 'bcrypt$hash']);
    });

    it('should translate Postgres unique-violation (23505) into EmailTakenError (FR-004)', async () => {
      const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
      queryMock.mockRejectedValueOnce(pgErr);

      await expect(
        insertUser({
          emailNormalized: 'bob@example.com',
          emailDisplay: 'bob@example.com',
          passwordHash: 'bcrypt$hash',
        }),
      ).rejects.toBeInstanceOf(EmailTakenError);
    });

    it('should rethrow non-unique-violation errors unchanged', async () => {
      const generic = new Error('connection lost');
      queryMock.mockRejectedValueOnce(generic);

      await expect(
        insertUser({
          emailNormalized: 'bob@example.com',
          emailDisplay: 'bob@example.com',
          passwordHash: 'bcrypt$hash',
        }),
      ).rejects.toBe(generic);
    });
  });

  describe('findUserByEmail', () => {
    it('should return null when no row matches', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      const user = await findUserByEmail('nobody@example.com');
      expect(user).toBeNull();
    });

    it('should return the mapped user when a row matches', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'u-2',
            email_normalized: 'carol@example.com',
            email_display: 'Carol@Example.com',
            password_hash: 'bcrypt$hash',
            created_at: new Date('2026-05-12T00:00:00Z'),
            last_login_at: new Date('2026-05-12T01:00:00Z'),
          },
        ],
      });
      const user = await findUserByEmail('carol@example.com');
      expect(user?.id).toBe('u-2');
      expect(user?.emailDisplay).toBe('Carol@Example.com');
    });
  });

  describe('updatePasswordHash', () => {
    it('should run an UPDATE with the new hash and user id', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await updatePasswordHash('u-3', 'new$bcrypt');
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/UPDATE users SET password_hash/i);
      expect(params).toEqual(['new$bcrypt', 'u-3']);
    });
  });

  describe('touchLastLogin', () => {
    it('should run an UPDATE setting last_login_at to now() for the given user', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      await touchLastLogin('u-4');
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/UPDATE users SET last_login_at = now\(\)/i);
      expect(params).toEqual(['u-4']);
    });
  });
});
