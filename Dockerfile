# syntax=docker/dockerfile:1

# --- Builder stage: install deps and build client + server ---
FROM node:20-slim AS builder
WORKDIR /app
ENV NODE_ENV=development

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- Runtime stage: minimal image with ffmpeg installed ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install ffmpeg for audio extraction/merging
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Prepare runtime directories
RUN mkdir -p /app/downloads /app/logs /app/bin

# Railway will inject PORT; default to 5000
ENV PORT=5000
EXPOSE 5000

CMD ["node", "dist/index.js"]