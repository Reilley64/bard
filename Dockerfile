FROM oven/bun AS base
RUN apt-get update && apt-get install -y make python3 ffmpeg
ENV NODE_ENV=production
WORKDIR /app

FROM base AS build
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY src ./
RUN bun build:public

FROM base AS runtime
COPY --from=build /app /app
ENTRYPOINT ["bun", "start"]
