# Use the official Playwright image with all deps preinstalled
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Set workdir
WORKDIR /app

# Real Google Chrome + a virtual display. Akamai/Cloudflare block Playwright-launched
# and headless browsers, so a few providers attach to headful Chrome over CDP
# (see src/playwright/browser.ts). Xvfb gives it a screen inside the container.
RUN npx -y playwright@1.55.0 install --with-deps chrome \
    && apt-get update && apt-get install -y --no-install-recommends xvfb tini \
    && rm -rf /var/lib/apt/lists/*

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
# Start a virtual display for real Chrome, then run the app.
# - tini is PID 1 so exited browser processes get reaped instead of piling up as zombies
# - stale X locks survive `docker restart` and would stop Xvfb from starting again
# - not using xvfb-run: as PID 1 it waits forever for Xvfb's ready signal
ENV DISPLAY=:99
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp & exec node dist/index.js"]