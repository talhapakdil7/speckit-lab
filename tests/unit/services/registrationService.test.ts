import { register } from '../../../src/services/registrationService';
import { ValidationError, EmailTakenError } from '../../../src/lib/errors';

/**
 * Unit tests for `registrationService.register` covering FR-002 (email
 * normalization handled by schema, not service — we only assert hashing/
 * persistence/session start), FR-003 (strength policy), FR-004 (duplicate
 * rejection), FR-005 (password persisted as bcrypt hash only, never
 * plaintext).
 *
 * Collaborators are mocked at the module boundary via jest.mock so the
 * service is exercised against fakes (constitution §6: mocks for
 * external code we own at the seam, fakes for repos).
 */

jest.mock('../../../src/services/passwordService', () => ({
  hash: jest.fn(async (plain: string) => `$2b$04$${Buffer.from(plain).toString('hex')}`),
  isStrong: jest.fn((plain: string) => plain.length >= 8 && /[^A-Za-z]/.test(plain)),
}));

jest.mock('../../../src/services/sessionService', () => ({
  startSession: jest.fn(async (_userId: string) => ({
    token: 'jwt.signed.token',
    expiresAt: '2026-05-13T00:00:00.000Z',
  })),
}));

jest.mock('../../../src/db/repositories/usersRepo', () => {
  const store = new Map<string, { id: string; emailNormalized: string; passwordHash: string }>();
  return {
    __store: store,
    insertUser: jest.fn(
      async (input: { emailNormalized: string; emailDisplay: string; passwordHash: string }) => {
        if (store.has(input.emailNormalized)) {
          const { EmailTakenError: E } = jest.requireActual('../../../src/lib/errors');
          throw new E();
        }
        const row = {
          id: `user-${store.size + 1}`,
          emailNormalized: input.emailNormalized,
          emailDisplay: input.emailDisplay,
          passwordHash: input.passwordHash,
          createdAt: new Date(),
          lastLoginAt: null,
        };
        store.set(input.emailNormalized, row);
        return row;
      },
    ),
    findUserByEmail: jest.fn(async (email: string) => store.get(email) ?? null),
  };
});

describe('registrationService.register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset shared fake store between tests for isolation (constitution §5).
    const usersRepo = jest.requireMock('../../../src/db/repositories/usersRepo') as {
      __store: Map<unknown, unknown>;
    };
    usersRepo.__store.clear();
  });

  it('should issue a session and persist the hashed password when input is valid (FR-005)', async () => {
    const usersRepo = jest.requireMock('../../../src/db/repositories/usersRepo') as {
      insertUser: jest.Mock;
    };
    const result = await register({ email: 'alice@example.com', password: 'correcthorse9' });

    expect(result.token).toBe('jwt.signed.token');
    expect(result.user).toEqual({ id: 'user-1', email: 'alice@example.com' });
    expect(usersRepo.insertUser).toHaveBeenCalledTimes(1);
    const insertArg = usersRepo.insertUser.mock.calls[0][0] as { passwordHash: string };
    expect(insertArg.passwordHash).toMatch(/^\$2b\$04\$/);
    expect(insertArg.passwordHash).not.toContain('correcthorse9');
  });

  it('should throw ValidationError when password fails the strength policy (FR-003)', async () => {
    await expect(
      register({ email: 'alice@example.com', password: 'short' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw EmailTakenError when the email is already registered (FR-004)', async () => {
    await register({ email: 'bob@example.com', password: 'correcthorse9' });
    await expect(
      register({ email: 'bob@example.com', password: 'correcthorse9' }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it('should never call insertUser with a plaintext password (FR-005)', async () => {
    const usersRepo = jest.requireMock('../../../src/db/repositories/usersRepo') as {
      insertUser: jest.Mock;
    };
    await register({ email: 'carol@example.com', password: 'correcthorse9' });
    for (const call of usersRepo.insertUser.mock.calls) {
      const arg = call[0] as { passwordHash: string };
      expect(arg.passwordHash).not.toBe('correcthorse9');
    }
  });
});
