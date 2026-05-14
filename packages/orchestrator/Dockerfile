# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install ALL deps (including devDeps for tsc)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Copy package.json and install ONLY production deps
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Fly.io injects env vars at runtime — no .env file needed
ENV NODE_ENV=production

EXPOSE 7860

CMD ["node", "dist/index.js"]
