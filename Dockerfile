# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV JWT_SECRET=${JWT_SECRET}

# Copy only the standalone build
COPY --from=builder /app/.next/standalone ./
# Static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# (optional) your /data folder if you really need it
COPY --from=builder /app/data ./data

RUN mkdir -p .next/cache && \
    mkdir -p /app/data && \
    chown -R node:node .next/cache /app/data

USER node

EXPOSE 3000

# run the Next.js server directly
CMD ["node", "server.js"]
