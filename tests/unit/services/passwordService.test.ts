import { hash, verify, isStrong } from '../../../src/services/passwordService';

describe('passwordService', () => {
  describe('hash + verify', () => {
    it('produces a bcrypt $2 hash that verifies the original password', async () => {
      const h = await hash('correcthorse9');
      expect(h).toMatch(/^\$2[aby]\$\d{2}\$/);
      await expect(verify('correcthorse9', h)).resolves.toBe(true);
    });

    it('rejects a wrong password', async () => {
      const h = await hash('correcthorse9');
      await expect(verify('wrong-password-1', h)).resolves.toBe(false);
    });

    it('returns false rather than throwing for a non-bcrypt value', async () => {
      await expect(verify('whatever', 'not-a-bcrypt-hash')).resolves.toBe(false);
    });
  });

  describe('isStrong', () => {
    it.each([
      ['correcthorse9', true],
      ['abcdefg9', true],
      ['short9', false], // too short
      ['allletters', false], // no non-alpha
      ['ALLLETTERS', false], // no non-alpha
      ['', false],
    ])('isStrong(%j) === %s', (input, expected) => {
      expect(isStrong(input)).toBe(expected);
    });
  });
});
