FROM node:22-alpine
WORKDIR /app

# NEXT_PUBLIC_* are baked into the browser bundle at build time, so pass them as
# Dokploy Build Args. Everything else is injected at runtime by Dokploy.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    JOB_WORKSPACE_DIR=/data/workspace

COPY package*.json ./
RUN npm ci
COPY . .

# Placeholder server vars only satisfy startup validation during the build;
# real values come from Dokploy at runtime.
RUN DATABASE_URL=postgresql://b:b@localhost:5432/b OPENROUTER_API_KEY=build \
    npm run build

ENV NODE_ENV=production
VOLUME ["/data/workspace"]
EXPOSE 3000
CMD ["npm", "run", "start"]
