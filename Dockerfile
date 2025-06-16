# Stage 1: Dependencies and Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json for dependency caching
COPY package.json ./
COPY package-lock.json ./

# Install build dependencies for native modules (sqlite3, sharp)
# Note: libsqlite3-dev is called sqlite-dev in Alpine Linux
# python3-dev is needed for node-gyp with newer Python versions (includes distutils compatibility)
RUN apk add --no-cache build-base python3 python3-dev sqlite-dev vips-dev

# Install dependencies (production only for smaller final image)
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Build the Next.js application
# Output to .next/standalone for a self-contained build
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment variables for production
# EasyPanel manages NODE_ENV and JWT_SECRET as runtime environment variables.
ENV PORT=3000

# Copy package.json from builder to ensure `npm start` works
COPY --from=builder /app/package.json ./

# Copy the standalone output, public assets, and data from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# bring in all the compiled static assets so /_next/static/... 404s go away
COPY --from=builder /app/.next/static   ./.next/static

# Create cache and data directories and set permissions for the non-root user
RUN mkdir -p .next/cache && \
    mkdir -p /app/data && \
    chown -R node:node .next/cache /app/data

# Use the existing `node` user for security
USER node

# Expose the port the application runs on
EXPOSE 3000

# Command to run the application
# Next.js standalone output creates a self-contained server.js
CMD ["npm", "start"]
