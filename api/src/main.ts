import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

const API_DESCRIPTION = `
Social media content approval workflow.

**Status workflow:** DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED,
and IN_REVIEW → CHANGES_REQUESTED → IN_REVIEW. Status only changes through
\`POST /posts/{id}/transitions\`; PUBLISHED is set by a background job.

**Errors** always have the shape
\`{ statusCode, error, code, message, path, timestamp }\` plus extra fields
for some codes, e.g. \`SCHEDULE_CONFLICT\` includes \`conflictingPostId\` and
\`VERSION_MISMATCH\` includes \`currentVersion\`.

**Try it:** call \`POST /auth/login\` (e.g. priya@campaignhub.test /
Password@123), copy \`accessToken\` and click **Authorize**.
`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CampaignHub API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
}
void bootstrap();
