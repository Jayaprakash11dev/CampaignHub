import { config } from 'dotenv';
import { join } from 'node:path';

// The e2e tests delete everything in their database between tests, so they
// must never point at the development database.
//
// Uses DATABASE_URL_TEST if set, otherwise DATABASE_URL from api/.env with
// "_test" added to the database name (campaignhub -> campaignhub_test).
export function testDatabaseUrl(): string {
  config({ path: join(__dirname, '..', '.env'), quiet: true });

  const explicit = process.env.DATABASE_URL_TEST;
  const url = new URL(explicit ?? process.env.DATABASE_URL ?? '');
  if (!explicit) {
    url.pathname = `${url.pathname}_test`;
  }

  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${dbName}": the database name must end in _test`,
    );
  }
  return url.toString();
}
