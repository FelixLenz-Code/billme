import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { authUserSchema, serverProductSchema, serverRoleSchema, type TenantScope } from '@billme/server-core';

const authSessionSchema = z.object({
  user: authUserSchema,
  scope: z.object({
    tenantId: z.string().min(1),
    product: serverProductSchema,
    deploymentMode: z.literal('single-tenant'),
  }),
  role: serverRoleSchema,
});

const tokenPayloadSchema = authSessionSchema.extend({
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthSessionInfo = {
  user: z.infer<typeof authUserSchema>;
  tenantId: string;
  product: z.infer<typeof serverProductSchema>;
  role: z.infer<typeof serverRoleSchema>;
};

const encodeBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decodeBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const INSECURE_SESSION_SECRETS = new Set([
  'billme-dev-session-secret',
  'replace-with-a-long-random-secret',
  'change-me',
]);
const MIN_SESSION_SECRET_LENGTH = 16;

export class SessionTokenService {
  private readonly secret: string;

  constructor(secret = process.env.SESSION_SECRET) {
    const normalized = secret?.trim() ?? '';
    if (normalized.length < MIN_SESSION_SECRET_LENGTH || INSECURE_SESSION_SECRETS.has(normalized)) {
      throw new Error(
        `SESSION_SECRET must be set to a strong, random value of at least ${MIN_SESSION_SECRET_LENGTH} characters. ` +
          'Refusing to start with a missing, default, or weak secret.',
      );
    }
    this.secret = normalized;
  }

  sign(session: AuthSession, ttlSeconds = 60 * 60 * 12): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = encodeBase64Url(
      JSON.stringify(
        tokenPayloadSchema.parse({
          ...session,
          iat: now,
          exp: now + ttlSeconds,
        }),
      ),
    );
    const signature = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  verify(token: string): AuthSession | null {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      return null;
    }

    const expected = createHmac('sha256', this.secret).update(payload).digest('base64url');
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      return null;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(decodeBase64Url(payload));
    } catch {
      return null;
    }

    const parsed = tokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      return null;
    }

    if (parsed.data.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return authSessionSchema.parse(parsed.data);
  }

  readBearerToken(headerValue: string | undefined): string | null {
    if (!headerValue) {
      return null;
    }
    const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
    return match?.[1] ?? null;
  }
}
