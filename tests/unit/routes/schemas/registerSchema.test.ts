import { registerSchema } from '../../../../src/routes/schemas/registerSchema';

/**
 * Unit tests for the `registerSchema` zod schema, asserting it accepts
 * inputs that conform to the OpenAPI `RegisterRequest` component and
 * rejects every documented violation. Tests are derived from the spec
 * (FR-002 email normalization; FR-003 password bounds) and from the
 * OpenAPI contract (`auth-api.openapi.yaml`).
 */
describe('registerSchema', () => {
  it('should accept a syntactically valid email with a policy-compliant password', () => {
    const parsed = registerSchema.parse({
      email: 'alice@example.com',
      password: 'correcthorse9',
    });
    expect(parsed).toEqual({
      email: 'alice@example.com',
      password: 'correcthorse9',
    });
  });

  it('should normalize email by trimming whitespace and lowercasing (FR-002)', () => {
    const parsed = registerSchema.parse({
      email: '  Carol@Example.COM ',
      password: 'correcthorse9',
    });
    expect(parsed.email).toBe('carol@example.com');
  });

  it('should reject a syntactically invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'correcthorse9',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a missing password field', () => {
    const result = registerSchema.safeParse({ email: 'alice@example.com' });
    expect(result.success).toBe(false);
  });

  it('should reject a missing email field', () => {
    const result = registerSchema.safeParse({ password: 'correcthorse9' });
    expect(result.success).toBe(false);
  });

  it('should reject unknown extra fields (strict schema)', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      password: 'correcthorse9',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('should reject an email longer than 254 characters', () => {
    const long = 'a'.repeat(250) + '@example.com';
    const result = registerSchema.safeParse({ email: long, password: 'correcthorse9' });
    expect(result.success).toBe(false);
  });
});
