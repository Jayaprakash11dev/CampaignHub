# ---- build ----
# Debian-based image rather than Alpine: bcrypt (native module) and the
# Prisma query engine both work out of the box on glibc.
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install first (cached unless package files change). The schema is needed
# because `npm ci` runs `prisma generate` as a postinstall step.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Dev dependencies are kept on purpose: the prisma CLI (migrations) and
# ts-node (seed) run inside the container on start-up.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json tsconfig.json ./
COPY src ./src

EXPOSE 3000

# Apply migrations, seed only if the database is empty, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts --if-empty && node dist/main"]
