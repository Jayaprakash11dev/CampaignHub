import { testDatabaseUrl } from './test-db';

// Runs before each test file, before AppModule is imported. ConfigModule
// does not override variables that are already set, so these win over .env.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_SECRET = 'e2e-test-secret';
process.env.JWT_EXPIRES_IN = '1h';
