# CampaignHub

Social media content approval system for agency client brands. Posts move through a
review workflow (draft → review → approval → scheduling → publishing) before going live.

- `api/` – NestJS + Prisma + PostgreSQL
- `web/` – React + Vite

## Local development

```bash
# Postgres runs in Docker, exposed on host port 5434 (to avoid clashing with a local install)
docker compose up -d db

cd api
cp .env.example .env
npm install
npm run start:dev      # http://localhost:3000/api
```

Full setup steps, environment variables and seed credentials will be documented here as the project comes together.
