# Build stage installs dependencies (and native bindings) once
FROM node:20-bullseye AS deps
WORKDIR /app
COPY package*.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev

# Runtime image keeps things slim
FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=/data/notes.db

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY migrations ./migrations

EXPOSE 4000
CMD ["node", "src/index.js"]
