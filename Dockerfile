# ============================================
# Stage 1: Dependencies & Build
# ============================================
FROM node:20-alpine AS builder

# bcrypt requires native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run server:build

# Build admin panel
RUN cd admin && npm ci && npm run build

# Build partner panel
RUN cd partner && npm ci && npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine

# bcrypt runtime needs libstdc++
RUN apk add --no-cache libstdc++ wget

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/server_dist ./server_dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/admin/dist ./admin/dist
COPY --from=builder /app/partner/dist ./partner/dist

# Create uploads directory
RUN mkdir -p uploads

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server_dist/index.js"]
