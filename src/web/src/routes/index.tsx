import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, PauseIcon, PlayIcon, RepeatIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert.tsx";
import { Input } from "~/components/ui/input.tsx";
import server from "~/lib/server.ts";
import usePlayer from "~/hooks/usePlayer.ts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

type Video = {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
}

export const Route = createFileRoute('/')({
  component: Home,
});

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { search } = Route.useSearch<{ search?: string }>();

  const player = usePlayer();

  const searchQuery = useQuery({
    queryKey: ["videos", "get", search],
    queryFn: async () => (await server.videos.get({ query: { search: search! } })).data,
    enabled: !!search,
  });

  const bookmarksQuery = useQuery<Array<Video>>({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const bookmarks = localStorage.getItem("bookmarks");
      return bookmarks ? JSON.parse(bookmarks) : [];
    },
  });

  const createBookmarkMutation = useMutation({
    mutationFn: async (body: Video) => {
      let bookmarks: Array<Video> = (() => {
        const bookmarks = localStorage.getItem("bookmarks");
        return bookmarks ? JSON.parse(bookmarks) : [];
      })();
      bookmarks = bookmarks.some((bookmark) => bookmark.id === body.id)
        ? bookmarks.filter((bookmark) => bookmark.id !== body.id)
        : [...bookmarks, body];
      localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
      return bookmarks;
    },
    onMutate: (variables) => {
      queryClient.setQueryData(["bookmarks"], (prev: Array<Video>) => [...prev, variables]);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });

  return (
    <div className="flex min-h-screen w-screen flex-col text-white font-[Geist]">
      <header className="sticky top-0 z-10 flex shrink-0 grow-0 basis-[64px] items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-[624px] items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();

              const formData = new FormData(e.currentTarget);
              void navigate({ search: { search: formData.get("search") as string } });
            }}
          >
            <Input name="search" placeholder="Search" />
          </form>
        </div>
      </header>

      <main className="flex grow pb-[90px]">
        <div className="mx-auto w-full max-w-[624px] flex-col">
          {searchQuery.isSuccess && (
            <div className="flex flex-col items-start space-y-5">
              {searchQuery.data && searchQuery.data.map((video) => (
                <div
                  key={video.id}
                  className="flex cursor-pointer justify-center space-x-5"
                  onDoubleClick={() => player.send?.({ type: "play", videoId: video.id })}
                >
                  <img alt={video.title} className="w-[256px] rounded-xl" src={video.thumbnail} />

                  <div className="flex flex-col">
                    <span className="text-[16px]">{video.title}</span>
                    <span className="text-muted-foreground">{video.author}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searchQuery.isSuccess && bookmarksQuery.isSuccess && bookmarksQuery.data.length > 0 && (
            <div className="flex flex-col items-start space-y-5">
              {bookmarksQuery.data && bookmarksQuery.data.map((video) => (
                <div
                  key={video.id}
                  className="flex cursor-pointer justify-center space-x-5"
                  onDoubleClick={() => player.send?.({ type: "play", videoId: video.id })}
                >
                  <img alt={video.title} className="w-[256px] rounded-xl" src={video.thumbnail} />

                  <div className="flex flex-col">
                    <span className="text-[16px]">{video.title}</span>
                    <span className="text-muted-foreground">{video.author}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchQuery.isPending && !searchQuery.isSuccess && bookmarksQuery.isSuccess && bookmarksQuery.data.length < 1 && (
            <Alert>
              <AlertTitle>
                Start searching to get started
              </AlertTitle>
              <AlertDescription>
                Videos will appear hear after you bookmark them
              </AlertDescription>
            </Alert>
          )}
        </div>
      </main>

      {(player && player.playing) && (
        <footer className="fixed flex bottom-0 left-0 w-screen animate-in slide-in-from-bottom animate-out slide-out-to-bottom">
          <div className="flex mx-auto mb-[24px] w-full max-w-[624px] items-center bg-accent text-accent-foreground rounded-lg p-[16px] shadow-md justify-between select-none">
            <div className="flex flex-col overflow-hidden">
              <span className="text-[14px] font-bold truncate">{player.playing.title}</span>
              <span className="text-[14px] text-muted-foreground truncate">{player.playing.author}</span>
            </div>

            <div className="flex space-x-5 ml-5">
              <BookmarkIcon
                fill={bookmarksQuery.data!.some((bookmark) => bookmark.id === player.playing!.id)
                  ? "hsl(262.1 83.3% 57.8%)"
                  : "currentColor"}
                onClick={() => createBookmarkMutation.mutate(player.playing!)}
                stroke={bookmarksQuery.data!.some((bookmark) => bookmark.id === player.playing!.id)
                  ? "hsl(262.1 83.3% 57.8%)"
                  : "currentColor"}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
              />

              <RepeatIcon
                fill={player.isRepeating ? "hsl(262.1 83.3% 57.8%)" : "currentColor"}
                onClick={() => player.send?.({ type: "repeat" })}
                stroke={player.isRepeating ? "hsl(262.1 83.3% 57.8%)" : "currentColor"}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
              />

              {player.isPaused
                ? (
                  <PlayIcon
                    fill="currentColor"
                    onClick={() => player.send?.({ type: "pause" })}
                    stroke="currentColor"
                    strokeWidth={1}
                    style={{ cursor: "pointer" }}
                  />
                ) : (
                  <PauseIcon
                    fill="currentColor"
                    onClick={() => player.send?.({ type: "pause" })}
                    stroke="currentColor"
                    strokeWidth={1}
                    style={{ cursor: "pointer" }}
                  />
                )}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
