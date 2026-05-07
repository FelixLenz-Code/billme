import { Pool, type PoolClient, type PoolConfig } from 'pg';

export const readDatabaseUrl = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const value = env.DATABASE_URL?.trim();
  return value && value.length > 0 ? value : null;
};

export const createPostgresPool = (config: string | PoolConfig): Pool => {
  if (typeof config === 'string') {
    return new Pool({ connectionString: config });
  }

  return new Pool(config);
};

export type PostgresQueryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
export type PostgresTransactionClient = PoolClient;

export const withPostgresTransaction = async <T>(
  pool: Pool,
  work: (client: PostgresTransactionClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors and rethrow original problem
    }
    throw error;
  } finally {
    client.release();
  }
};

export const withSerializablePostgresTransaction = async <T>(
  pool: Pool,
  work: (client: PostgresTransactionClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors and rethrow original problem
    }
    throw error;
  } finally {
    client.release();
  }
};
