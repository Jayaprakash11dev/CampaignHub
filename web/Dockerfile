# ---- build ----
FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Vite bakes this into the bundle at build time. "/api" means "same origin":
# nginx below forwards /api to the API container, so there's no CORS and no
# hard-coded host.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- serve ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
