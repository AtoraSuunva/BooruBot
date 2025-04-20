# Step that pulls in everything needed to build the app and builds it
# Pinned to avoid sudden new versions breaking builds :)
FROM node:22.14-alpine AS dev-build
ARG GIT_COMMIT_SHA
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA:-development}
WORKDIR /home/node/app
RUN corepack enable
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY pnpm-workspace.yaml ./
RUN pnpm fetch
RUN pnpm install --frozen-lockfile --offline
COPY tsconfig.json ./
COPY /prisma ./prisma/
COPY /scripts ./scripts/
RUN pnpm run generate
COPY src/ ./src/
RUN pnpm run build
RUN cp src/generated/prisma/*.node dist/generated/prisma/
COPY /resources ./resources/
RUN pnpm sentry:sourcemaps:inject


# Step that only pulls in (production) deps required to run the app
FROM node:22.14-alpine AS prod-build
WORKDIR /home/node/app
RUN corepack enable
COPY --from=dev-build /home/node/app/pnpm-lock.yaml ./
COPY --from=dev-build /home/node/app/node_modules ./node_modules/
COPY --from=dev-build /home/node/app/package.json ./
COPY --from=dev-build /home/node/app/pnpm-workspace.yaml ./
COPY --from=dev-build /home/node/app/prisma ./prisma/
RUN pnpm fetch --prod
RUN pnpm install --prod --frozen-lockfile --offline
COPY --from=dev-build /home/node/app/dist ./dist/
COPY --from=dev-build /home/node/app/resources ./resources/


# The actual runtime itself
FROM node:22.14-alpine AS prod-runtime
# See https://github.com/prisma/prisma/issues/19729
RUN apk upgrade --update-cache --available && \
    apk add openssl && \
    rm -rf /var/cache/apk/*
WORKDIR /home/node/app
COPY --from=prod-build /home/node/app ./
USER node
CMD [ "npm", "run", "start:prod" ]
