import { z } from 'zod';
import { createPostgresPool, importDesktopSqliteToPostgres, readDatabaseUrl } from '../postgres';

const envSchema = z.object({
  SQLITE_PATH: z.string().trim().min(1),
  SERVER_PRODUCT: z.enum(['lite', 'pro']),
  TENANT_ID: z.string().trim().min(1).default('default'),
  TENANT_SLUG: z.string().trim().min(1).default('default'),
  TENANT_NAME: z.string().trim().min(1).default('Billme'),
  ALLOW_PARTIAL_IMPORT: z.coerce.boolean().default(false),
});

const databaseUrl = readDatabaseUrl(process.env);
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const env = envSchema.parse(process.env);
const pool = createPostgresPool(databaseUrl);
try {
  const result = await importDesktopSqliteToPostgres({
    pool,
    sqlitePath: env.SQLITE_PATH,
    product: env.SERVER_PRODUCT,
    tenant: {
      id: env.TENANT_ID,
      slug: env.TENANT_SLUG,
      displayName: env.TENANT_NAME,
    },
    failOnUnsupportedData: !env.ALLOW_PARTIAL_IMPORT,
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
