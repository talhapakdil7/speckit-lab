import jwt from 'jsonwebtoken';
import { issueToken, verifyToken } from '../../../src/services/tokenService';

const SECRET = 'a'.repeat(40);

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  process.env.DATABASE_URL = 'postgres://test';
  process.env.PUBLIC_URL = 'http://localhost:3000';
  // Force re-read of env in case prior tests cached it
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const env = require('../../../src/config/env') as typeof import('../../../src/config/env');
  env._resetEnvCacheForTests();
});

describe('tokenService', () => {
  it('issues a JWT whose claims encode userId, jti, and a 24-hour lifetime', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const jti = '22222222-2222-4222-8222-222222222222';
    const { token, expiresAt } = issueToken({ userId, jti });

    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.sub).toBe(userId);
    expect(decoded.jti).toBe(jti);
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(24 * 3600);

    // expiresAt is the ISO of exp
    expect(new Date(expiresAt).getTime() / 1000).toBeCloseTo(decoded.exp as number, 0);
  });

  it('verifyToken returns claims for a valid token', () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const jti = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { token } = issueToken({ userId, jti });
    const claims = verifyToken(token);
    expect(claims.sub).toBe(userId);
    expect(claims.jti).toBe(jti);
  });

  it('verifyToken throws on tampered token', () => {
    const { token } = issueToken({
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      jti: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.AAAA${parts[2]?.slice(4) ?? ''}`;
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('verifyToken throws on token signed with a different secret', () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const jti = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const foreign = jwt.sign({ sub: userId, jti }, 'another-secret-of-sufficient-length-XXXXXX', {
      algorithm: 'HS256',
      expiresIn: '24h',
    });
    expect(() => verifyToken(foreign)).toThrow();
  });
});
