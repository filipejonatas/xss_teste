# --- Base build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci

# Copy tsconfig and the rest of the source
COPY tsconfig.json ./tsconfig.json
COPY . .

# Build TypeScript -> dist
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only package files and install prod deps
COPY package*.json ./ 
RUN npm ci --omit=dev

# Copy built app and static assets from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
# assets folder is optional; copy only if it exists
COPY --from=build /app/assets ./assets

EXPOSE 3000
CMD ["node", "dist/app.js"]