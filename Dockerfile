# Multi-stage production build for Hugging Face Spaces (Docker)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy application source files
COPY . .

# Compile React client assets and Express server to /dist
RUN npm run build

# --- Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Hugging Face Space expects containers to listen on port 7860
ENV PORT=7860

# Copy packages to install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled folders from the builder stage
COPY --from=builder /app/dist ./dist

# Expose port 7860
EXPOSE 7860

# Run the compiled CommonJS production bundle
CMD ["npm", "start"]
