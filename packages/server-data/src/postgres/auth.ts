import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import {
  normalizeEmailAddress,
  type AuthUser,
  type BootstrapRequest,
  type BootstrapStatus,
  type LoginRequest,
  type ServerProduct,
  type ServerRole,
  type UserAccount,
} from '@billme/server-core';
import { withSerializablePostgresTransaction } from './connection.js';
import { createPostgresBillingDependencies } from './billing.js';

export interface ServerAuthStore {
  getBootstrapStatus(product: ServerProduct): Promise<BootstrapStatus>;
  bootstrap(product: ServerProduct, input: BootstrapRequest): Promise<{
    tenantId: string;
    product: ServerProduct;
    role: ServerRole;
    user: AuthUser;
  }>;
  login(product: ServerProduct, input: LoginRequest): Promise<{
    tenantId: string;
    product: ServerProduct;
    role: ServerRole;
    user: AuthUser;
  }>;
}

const derivePasswordHash = (password: string, salt: string): string => {
  return scryptSync(password, salt, 64).toString('hex');
};

const constantTimeEquals = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
};

const createSalt = (): string => randomUUID().replaceAll('-', '');

const createTenantSeed = (product: ServerProduct) => {
  const suffix = product === 'pro' ? 'pro' : 'lite';
  const label = product === 'pro' ? 'Billme Pro' : 'Billme';
  return {
    id: randomUUID(),
    slug: `${suffix}-primary`,
    displayName: label,
    product,
    deploymentMode: 'single-tenant' as const,
    status: 'active' as const,
  };
};

const toAuthResponse = (
  tenantId: string,
  product: ServerProduct,
  user: Pick<UserAccount, 'id' | 'email' | 'fullName'> & { role: 'owner' | 'admin' | 'accountant' | 'sales' | 'viewer' },
): {
  tenantId: string;
  product: ServerProduct;
  role: ServerRole;
  user: AuthUser;
} => ({
  tenantId,
  product,
  role: user.role,
  user: {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  },
});

export const createPostgresAuthStore = (pool: Pool): ServerAuthStore => ({
  async getBootstrapStatus(product) {
    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(DISTINCT u.id)::text AS count
        FROM user_accounts u
        JOIN tenant_memberships m ON m.user_id = u.id
        JOIN tenants t ON t.id = m.tenant_id
        WHERE t.product = $1
      `,
      [product],
    );
    const userCount = Number(result.rows[0]?.count ?? 0);
    return {
      bootstrapped: userCount > 0,
      userCount,
    };
  },

  async bootstrap(product, input) {
    return withSerializablePostgresTransaction(pool, async (client) => {
      const existingTenant = await client.query<{ id: string }>('SELECT id FROM tenants WHERE product = $1 LIMIT 1', [product]);
      if (existingTenant.rows[0]) {
        throw new Error(`Bootstrap already completed for ${product}`);
      }

      const email = normalizeEmailAddress(input.email);
      const existingUser = await client.query<{ id: string }>('SELECT id FROM user_accounts WHERE lower(email) = lower($1) LIMIT 1', [email]);
      if (existingUser.rows[0]) {
        throw new Error('A user with this email already exists');
      }

      const now = new Date().toISOString();
      const tenant = createTenantSeed(product);
      const userId = randomUUID();
      const membershipId = randomUUID();
      const salt = createSalt();
      const dependencies = createPostgresBillingDependencies(client);
      const scope = { tenantId: tenant.id, product, deploymentMode: 'single-tenant' as const };
      await dependencies.tenantRepo.save({
        ...tenant,
        createdAt: now,
        updatedAt: now,
      });
      await dependencies.userRepo.save(scope, {
        id: userId,
        email,
        fullName: input.fullName.trim(),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      await dependencies.membershipRepo.save(
        { tenantId: tenant.id, product, deploymentMode: 'single-tenant' },
        {
          id: membershipId,
          tenantId: tenant.id,
          userId,
          role: 'owner',
          createdAt: now,
          updatedAt: now,
        },
      );
      await client.query(
        `
          INSERT INTO user_password_credentials (
            user_id, password_salt, password_hash, password_algorithm, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          )
        `,
        [userId, salt, derivePasswordHash(input.password, salt), 'scrypt-64', now, now],
      );

      return toAuthResponse(tenant.id, product, {
        id: userId,
        email,
        fullName: input.fullName.trim(),
        role: 'owner',
      });
    });
  },

  async login(product, input) {
    const email = normalizeEmailAddress(input.email);
    const result = await pool.query<{
      tenant_id: string;
      id: string;
      email: string;
      full_name: string;
      role: 'owner' | 'admin' | 'accountant' | 'sales' | 'viewer';
      password_salt: string;
      password_hash: string;
    }>(
      `
        SELECT
          m.tenant_id,
          u.id,
          u.email,
          u.full_name,
          m.role,
          c.password_salt,
          c.password_hash
        FROM user_accounts u
        JOIN user_password_credentials c ON c.user_id = u.id
        JOIN tenant_memberships m ON m.user_id = u.id
        JOIN tenants t ON t.id = m.tenant_id
        WHERE lower(u.email) = lower($1)
          AND t.product = $2
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at ASC
        LIMIT 1
      `,
      [email, product],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Invalid email or password');
    }

    const candidateHash = derivePasswordHash(input.password, row.password_salt);
    if (!constantTimeEquals(candidateHash, row.password_hash)) {
      throw new Error('Invalid email or password');
    }

    await pool.query('UPDATE user_accounts SET last_login_at = $1 WHERE id = $2', [new Date().toISOString(), row.id]);

    return toAuthResponse(row.tenant_id, product, {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
    });
  },
});
