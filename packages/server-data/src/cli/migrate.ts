import { createPostgresPool, readDatabaseUrl, runPostgresMigrations } from '../postgres';

const databaseUrl = readDatabaseUrl(process.env);
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = createPostgresPool(databaseUrl);
try {
  const result = await runPostgresMigrations(pool);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
