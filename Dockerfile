FROM oven/bun AS base
RUN apt-get update && apt-get install -y build-essential python3 ffmpeg
ENV NODE_ENV=production
WORKDIR /app

FROM base as public
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
RUN bun build:public

FROM base AS start
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY src ./
COPY --from=public /app/public /app/public
ENTRYPOINT ["bun", "start"]
