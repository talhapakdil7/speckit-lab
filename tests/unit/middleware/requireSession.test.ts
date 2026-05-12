import type { Request, Response, NextFunction } from 'express';
import { requireSession } from '../../../src/middleware/requireSession';
import { UnauthenticatedError } from '../../../src/lib/errors';
import jwt from 'jsonwebtoken';

/**
 * Unit tests for the `requireSession` middleware (constitution §11
 * authorization negative paths). Covers FR-008, FR-009, FR-015:
 * rejects missing / malformed / expired / tampered / revoked tokens
 * with a generic UnauthenticatedError; populates `req.user` on success.
 */

jest.mock('../../../src/services/tokenService', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../../src/db/repositories/sessionsRepo', () => ({
  findActiveByJti: jest.fn(),
}));

const buildReq = (auth?: string): Request =>
  ({ headers: auth ? { authorization: auth } : {} }) as unknown as Request;
const buildRes = (): Response => ({}) as Response;

describe('requireSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject when the Authorization header is missing', async () => {
    const req = buildReq();
    const next = jest.fn() as unknown as NextFunction;
    await requireSession(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('should reject when the Authorization header is not a Bearer scheme', async () => {
    const req = buildReq('Basic abc==');
    const next = jest.fn() as unknown as NextFunction;
    await requireSession(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('should reject when verifyToken throws (tampered or expired JWT)', async () => {
    const { verifyToken } = jest.requireMock('../../../src/services/tokenService') as {
      verifyToken: jest.Mock;
    };
    verifyToken.mockImplementation(() => {
      throw new jwt.TokenExpiredError('expired', new Date());
    });
    const req = buildReq('Bearer aaa.bbb.ccc');
    const next = jest.fn() as unknown as NextFunction;
    await requireSession(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('should reject when the session row is missing or revoked (FR-009, FR-015)', async () => {
    const { verifyToken } = jest.requireMock('../../../src/services/tokenService') as {
      verifyToken: jest.Mock;
    };
    const { findActiveByJti } = jest.requireMock(
      '../../../src/db/repositories/sessionsRepo',
    ) as { findActiveByJti: jest.Mock };
    verifyToken.mockReturnValue({ sub: 'u-1', jti: 'j-1', iat: 1, exp: 2 });
    findActiveByJti.mockResolvedValue(null);

    const req = buildReq('Bearer aaa.bbb.ccc');
    const next = jest.fn() as unknown as NextFunction;
    await requireSession(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('should reject when the session belongs to a different user', async () => {
    const { verifyToken } = jest.requireMock('../../../src/services/tokenService') as {
      verifyToken: jest.Mock;
    };
    const { findActiveByJti } = jest.requireMock(
      '../../../src/db/repositories/sessionsRepo',
    ) as { findActiveByJti: jest.Mock };
    verifyToken.mockReturnValue({ sub: 'u-1', jti: 'j-1', iat: 1, exp: 2 });
    findActiveByJti.mockResolvedValue({
      jti: 'j-1',
      userId: 'u-OTHER',
      issuedAt: new Date(),
      expiresAt: new Date(),
      revokedAt: null,
      revokedReason: null,
    });

    const req = buildReq('Bearer aaa.bbb.ccc');
    const next = jest.fn() as unknown as NextFunction;
    await requireSession(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('should populate req.user and call next() with no argument on a valid session', async () => {
    const { verifyToken } = jest.requireMock('../../../src/services/tokenService') as {
      verifyToken: jest.Mock;
    };
    const { findActiveByJti } = jest.requireMock(
      '../../../src/db/repositories/sessionsRepo',
    ) as { findActiveByJti: jest.Mock };
    verifyToken.mockReturnValue({ sub: 'u-1', jti: 'j-1', iat: 1, exp: 2 });
    findActiveByJti.mockResolvedValue({
      jti: 'j-1',
      userId: 'u-1',
      issuedAt: new Date(),
      expiresAt: new Date(),
      revokedAt: null,
      revokedReason: null,
    });

    const req = buildReq('Bearer aaa.bbb.ccc');
    const next = jest.fn() as unknown as NextFunction;
    await requireSession(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'u-1', jti: 'j-1' });
  });
});
