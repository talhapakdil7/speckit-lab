import { z } from 'zod';

/**
 * zod schema for `POST /auth/register` matching the OpenAPI `RegisterRequest`
 * component. Email is normalized (trim + lowercase) so downstream code never
 * has to repeat that step (FR-002). Password length bounds match the policy
 * tested separately by passwordService.isStrong (FR-003).
 */
export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(200),
  })
  .strict();

/** Inferred TypeScript type for register requests. */
export type RegisterInput = z.infer<typeof registerSchema>;
