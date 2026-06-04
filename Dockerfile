# Inventario Hogar — production image
# node:sqlite is a built-in (Node >= 22.5); Node 24 has it stable.
FROM node:24-slim

# App directory
WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# The app listens on PORT (Fly sets it via env / fly.toml internal_port)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Data + uploads live on a mounted volume (see fly.toml [mounts])
# DB_PATH and UPLOADS_DIR are provided via fly.toml [env]

CMD ["node", "server.js"]
