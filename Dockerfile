# Step that pulls in everything needed to build the app and builds it
FROM node:26-alpine AS dev-build
WORKDIR /home/node/app
RUN npm install -g corepack
RUN corepack enable
COPY package.json ./
RUN corepack install
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
RUN apk add --no-cache python3 make g++
RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY /prisma/schema.prisma ./prisma/schema.prisma
COPY /prisma/models ./prisma/models/
RUN pnpm run generate
COPY src/ ./src/
RUN pnpm run build
COPY /resources ./resources/
RUN pnpm sentry:sourcemaps:inject


# Step that only pulls in (production) deps required to run the app
FROM dev-build AS prod-build
ENV CI=true
COPY /prisma ./prisma/
RUN pnpm prune --prod


# The actual runtime itself
FROM node:26-alpine AS prod-runtime
ARG GIT_COMMIT_SHA
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA:-development}
ENV NODE_ENV=production
# See https://github.com/prisma/prisma/issues/19729
RUN apk upgrade --update-cache --available && \
    apk add --no-cache openssl && \
    rm -rf /var/cache/apk/*
WORKDIR /home/node/app
COPY --from=prod-build /home/node/app/node_modules ./node_modules/
COPY --from=prod-build /home/node/app/package.json ./package.json
COPY --from=prod-build /home/node/app/prisma.config.ts ./prisma.config.ts
COPY --from=prod-build /home/node/app/prisma ./prisma/
COPY --from=prod-build /home/node/app/dist ./dist/
COPY --from=prod-build /home/node/app/resources ./resources/
RUN mkdir -p /home/node/app/prisma/db
RUN chown -R node:node /home/node/app/prisma/db
USER node
CMD [ "npm", "run", "start:prod" ]
