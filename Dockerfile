# Stage 1: Dependencies and Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json for dependency caching
COPY package.json ./
COPY package-lock.json ./

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
ENV NODE_ENV=production
ENV PORT=3000

# Copy package.json from builder to ensure `npm start` works
COPY --from=builder /app/package.json ./

# Copy the standalone output and public assets from the builder stage
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public

# Create cache directory and set permissions for the non-root user
RUN mkdir -p .next/cache && \
    chown -R node:node .next/cache

# Use the existing `node` user for security
USER node

# Expose the port the application runs on
EXPOSE 3000

# Command to run the application
# Next.js standalone output creates a self-contained server.js
# We explicitly set the hostname to 0.0.0.0 to ensure it's reachable from outside the container
CMD ["node", "server.js", "-H", "0.0.0.0"]
