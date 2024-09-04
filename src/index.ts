import {
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import ytdl from "@distube/ytdl-core";
import cors from "@elysiajs/cors";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { Elysia, t } from "elysia";
import { google } from "googleapis";
import { type ServerWebSocket } from "bun";
import type { ElysiaWS } from "elysia/ws";
import staticPlugin from "@elysiajs/static";

import { BadRequestException, NotFoundException, ResponseStatusException } from "./errors.ts";

type Video = {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
};

type Connection = {
  id: string;
  playing?: Video;
  isPaused: boolean;
  isRepeating: boolean;
  connection: VoiceConnection;
  player: AudioPlayer;
  clients: Array<ElysiaWS<ServerWebSocket<any>, any, any>>;
}

enum MessageType {
  Play = "play",
  Pause = "pause",
  Repeat = "repeat",
}

const connections = new Map<string, Connection>();

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

discord.on(Events.ClientReady, () => {
  console.log(`Logged in as ${discord.user!.tag}!`);
});

void discord.login(process.env.DISCORD_TOKEN!);

const youtube = google.youtube({
  version: "v3",
  auth: process.env.GOOGLE_API_KEY!,
});

function findEntityByChannelId(channelId: string) {
  if (!connections.has(channelId)) {
    throw new BadRequestException(`Channel with id ${channelId} hasn't been joined`);
  }

  return connections.get(channelId)!;
}

function findEntityByChannelIdAndCheckPlaying(channelId: string) {
  const entity = findEntityByChannelId(channelId);

  if (!entity.playing) {
    throw new BadRequestException(`Channel with id ${channelId} is not playing anything`);
  }

  return entity;
}

function entityToDto(entity: Connection) {
  return {
    id: entity.id,
    playing: entity.playing,
    isPaused: entity.isPaused,
    isRepeating: entity.isRepeating,
  };
}

function updateEntity(entity: Connection) {
  connections.set(entity.id, entity);
  entity.clients.forEach((client) => client.send({ status: 200, body: entityToDto(entity) }));
}

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ prefix: "/" }))
  .get("/", () => Bun.file("public/index.html"))
  .ws("/guild/:guildId/channel/:channelId", {
    open: async (ws) => {
      try {
        const guildId = ws.data.params.guildId;
        const channelId = ws.data.params.channelId;

        if (connections.has(ws.data.params.channelId)) {
          const entity = connections.get(channelId)!;
          entity.clients.push(ws);
          ws.send({status: 200, body: entityToDto(entity)});
          return;
        }

        const guild = await discord.guilds.fetch(guildId);
        if (!guild) {
          throw new NotFoundException(`Guild with id ${guildId} not found`);
        }

        const channel = await guild.channels.fetch(channelId);
        if (!channel) {
          throw new NotFoundException(`Channel with id ${channelId} not found`);
        }

        const connection = await (async () => {
          const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
          });

          try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            return connection;
          } catch (error) {
            connection.destroy();
            throw error;
          }
        })();

        const player = createAudioPlayer({
          behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
            // maxMissedFrames: Math.round(maxTransmissionGap / 20),
          },
        });

        player.on(AudioPlayerStatus.Idle, () => {
          if (!connections.has(channelId)) return;

          const entity = connections.get(channelId)!;

          if (entity.playing && entity.isRepeating) {
            entity.player.play(createAudioResource(ytdl(`https://www.youtube.com/watch?v=${entity.playing.id}`, {
              filter: "audioonly",
              highWaterMark: 1 << 25
            })));
            return;
          }

          entity.playing = undefined;
          entity.isRepeating = false;
          updateEntity(entity);
        });

        connection.subscribe(player);

        const entity = {
          id: channelId,
          playing: undefined,
          isPaused: false,
          isRepeating: false,
          connection,
          player,
          clients: [ws],
        };
        updateEntity(entity);
      } catch (error) {
        if (error instanceof ResponseStatusException) {
          ws.send({ status: error.status, body: { title: error.message, status: error.status, detail: error.detail } });
          return;
        }

        ws.send({ status: 500, body: { title: "Internal server error", status: 500 } });
      }
    },
    message: async (ws, message) => {
      try {
        switch (message.type) {
          case MessageType.Play: {
            const entity = findEntityByChannelId(ws.data.params.channelId);

            const url = `https://www.youtube.com/watch?v=${message.videoId}`;

            const info = await ytdl.getInfo(url);

            entity.player.play(createAudioResource(ytdl(url, { filter: "audioonly", highWaterMark: 1<<25 })));
            entity.playing = {
              id: info.videoDetails.videoId,
              title: info.videoDetails.title,
              author: info.videoDetails.author.name,
              thumbnail: info.videoDetails.thumbnails.pop()!.url,
            };
            entity.isPaused = false;
            entity.isRepeating = false;

            updateEntity(entity);
            return;
          }

          case MessageType.Pause: {
            const entity = findEntityByChannelIdAndCheckPlaying(ws.data.params.channelId);
            if (!entity.isPaused) entity.player.pause(); else entity.player.unpause();
            entity.isPaused = !entity.isPaused;
            updateEntity(entity);
            return;
          }

          case MessageType.Repeat: {
            const entity = findEntityByChannelIdAndCheckPlaying(ws.data.params.channelId);
            entity.isRepeating = !entity.isRepeating;
            updateEntity(entity);
            return;
          }
        }
      } catch (error) {
        if (error instanceof ResponseStatusException) {
          ws.send({ status: error.status, body: { title: error.message, status: error.status, detail: error.detail } });
          return;
        }

        ws.send({ status: 500, body: { title: "Internal server error", status: 500 } });
      }
    },
    body: t.Union([
      t.Object({
        type: t.Literal(MessageType.Play),
        videoId: t.String(),
      }),
      t.Object({
        type: t.Literal(MessageType.Pause),
      }),
      t.Object({
        type: t.Literal(MessageType.Repeat),
      }),
    ]),
    response: t.Union([
      t.Object({
        status: t.Numeric({ minimum: 200, maximum: 299 }),
        body: t.Object({
          id: t.String(),
          playing: t.Optional(t.Object({
            id: t.String(),
            title: t.String(),
            author: t.String(),
            thumbnail: t.String(),
          })),
          isPaused: t.Boolean(),
          isRepeating: t.Boolean(),
        }),
      }),
      t.Object({
        status: t.Numeric({ minimum: 300 }),
        body: t.Object({
          title: t.String(),
          status: t.Numeric({ minimum: 300 }),
          detail: t.Optional(t.String()),
        }),
      }),
    ]),
  })
  .get("/videos", async ({ query }) => {
    const videos = (await youtube.search.list({ part: ["snippet"], q: query.search, type: ["video"] })).data.items;

    return videos ? videos.map((video) => ({
      id: video.id!.videoId!,
      title: video.snippet!.title!,
      author: video.snippet!.channelTitle!,
      thumbnail: video.snippet!.thumbnails!.high!.url!,
    })) : [];
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
    }),
  })
  .listen(process.env.PORT || 3000);

export type App = typeof app;
