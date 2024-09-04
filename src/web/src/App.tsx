import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import Player from "~/components/Player.tsx";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  useEffect(() => {
    window.document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={client}>
      <Player />
    </QueryClientProvider>
  );
}
