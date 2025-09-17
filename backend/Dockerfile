# Use the official Playwright image with all deps preinstalled
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Set workdir
WORKDIR /app 

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Copy only package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install prod deps
RUN pnpm install --frozen-lockfile

# Copy the rest
COPY . .

# Build TypeScript
RUN pnpm exec tsc -b

# Set environment
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Expose app port
EXPOSE 8080

# Start the app
CMD ["node", "dist/index.js"]