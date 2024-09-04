import { EdenWS } from "@elysiajs/eden/treaty";
import { useEffect, useRef, useState } from "react";
import server from "~/lib/server.ts";

type Video = {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
};

type Connection = {
  id: string;
  playing: Video | null;
  isPaused: boolean;
  isRepeating: boolean;
}

export default function usePlayer() {
  const [latest, setLatest] = useState<Connection>();

  const player = useRef<EdenWS<{
    body: { type: "play"; videoId: string; } | { type: "pause"; } | { type: "repeat"; };
    params: { guildId: string; channelId: string; };
    query: unknown;
    headers: unknown;
    response: unknown;
  }>>();

  useEffect(() => {
    player.current = server.guild({ guildId: "1278982631463063613" }).channel({ channelId: "1278982632448983040" }).subscribe();

    player.current?.subscribe((message) => {
      if (!message.data) return;
      const data = message.data as { status: number, body: Connection };
      if (data.status > 200) return;

      setLatest(data.body);
      return;
    });

    return () => {
      player.current?.close();
    };
  }, []);

  return {
    id: latest?.id,
    playing: latest?.playing,
    isPaused: latest?.isPaused,
    isRepeating: latest?.isRepeating,
    send: (data: { type: "play", videoId: string } | { type: "pause" } | {
      type: "repeat"
    }) => player.current?.send(data),
  };
}
