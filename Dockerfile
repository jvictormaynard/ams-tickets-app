# ── In your build stage:
FROM node:18-alpine AS builder
WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci

# copy source
COPY . .

# ← Add these two lines before the build
ARG JWT_SECRET
ENV JWT_SECRET=$JWT_SECRET

# build your Next.js app
RUN npm run build

# ── In your production stage:
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# copy only what's needed to run
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm","start"]
