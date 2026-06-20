// src/app/lib/prisma.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { PrismaClient as MySqlClient } from '../../generated/client-mysql/client';

type AppPrismaClient = MySqlClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

function createPrismaClient(): AppPrismaClient {
  const dbMode = process.env.DB_MODE || 'LOCAL_MYSQL';

  if (dbMode === 'CLOUD_POSTGRES') {
    const { PrismaClient: PgClient } = require('../../generated/client-postgres/client');
    const adapter = new PrismaPg({
      connectionString: process.env.POSTGRES_URL!,
    });

    return new PgClient({
      adapter,
      log: ['query', 'error', 'warn'],
    }) as AppPrismaClient;
  }

  const { PrismaClient: MySQLClient } = require('../../generated/client-mysql/client');
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER ?? 'root',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? '',
    connectionLimit: 5,
  });

  return new MySQLClient({
    adapter,
    log: ['query', 'error', 'warn'],
  }) as AppPrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}