import { INestApplication, ValidationPipe } from '@nestjs/common';

// CORS_ORIGIN is a comma-separated list of allowed frontend origins, e.g.
// "https://campaignhub.vercel.app". Unset or empty = allow any origin, which
// is what local development and Docker use.
export function parseCorsOrigins(value: string | undefined): string[] | true {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

// Global settings shared by main.ts and the end-to-end tests, so the tests
// run the app exactly as it runs in production.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGIN) });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
