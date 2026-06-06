# Use Node 22+ for native node:sqlite support
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# We need to build the app
ENV IS_DOCKER_BUILD=1
RUN npm run build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create required directories for persistent volumes
RUN mkdir -p /app/upload /app/backups /app/data

# Copy over built assets and standalone server
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy scripts and entrypoint
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/start.sh ./
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh
EXPOSE 3000

# Next.js standalone build requires hostname 0.0.0.0
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./start.sh"]
