FROM oven/bun AS base
RUN apt-get update && apt-get install -y build-essential python3 ffmpeg
ENV NODE_ENV=production
WORKDIR /app

FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY src ./

FROM base AS start
COPY --from=install /app /app
ENTRYPOINT ["bun", "start"]
