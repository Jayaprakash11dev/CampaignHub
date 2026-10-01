import { INestApplication, ValidationPipe } from '@nestjs/common';

// Global settings shared by main.ts and the end-to-end tests, so the tests
// run the app exactly as it runs in production.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
