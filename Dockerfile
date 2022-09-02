# Step that pulls in everything needed to build the app and builds it
FROM node:18-slim as dev-build
WORKDIR /home/node/app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY prisma/ ./prisma/
RUN pnpm install
COPY src/ ./src/
RUN pnpm run build


# Step that only pulls in (production) deps required to run the app
FROM node:18-slim as prod-build
WORKDIR /home/node/app
RUN npm install -g pnpm
COPY --from=dev-build /home/node/app/package.json /home/node/app/pnpm-lock.yaml ./
COPY --from=dev-build /home/node/app/prisma ./prisma
COPY --from=dev-build /home/node/app/dist ./dist
RUN pnpm fetch --prod
RUN pnpm install -r --offline --prod
RUN pnpx prisma generate

# The actual runtime itself
FROM node:18-slim as prod-runtime
WORKDIR /home/node/app
COPY --from=prod-build /home/node/app ./
USER node
CMD [ "npm", "run", "start:prod" ]
