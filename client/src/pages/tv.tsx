import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, SkipForward, Music, Users } from "lucide-react";
import type { Room, QueueItem } from "@shared/schema";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function TVPage() {
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  useEffect(() => {
    if (!ytReady || !currentVideoId || !playerContainerRef.current) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(currentVideoId);
      if (isPlaying) {
        playerRef.current.playVideo();
      }
      return;
    }

    playerRef.current = new window.YT.Player("youtube-player", {
      videoId: currentVideoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: (event: any) => {
          if (isPlaying) {
            event.target.playVideo();
          }
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            handleSkip();
          }
        },
      },
    });
  }, [ytReady, currentVideoId]);

  useEffect(() => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.playVideo?.();
    } else {
      playerRef.current.pauseVideo?.();
    }
  }, [isPlaying]);

  const connectWebSocket = useCallback((roomCode: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", roomCode }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "room_state":
          setRoom(message.room);
          setQueue(message.queue);
          setIsPlaying(message.room.isPlaying || false);
          setCurrentVideoId(message.room.currentVideoId);
          setCurrentTitle(message.room.currentVideoTitle);
          break;

        case "queue_updated":
          setQueue(message.queue);
          break;

        case "song_added":
          toast({
            title: "Song Added",
            description: message.song.title,
            className: "bg-success text-success-foreground border-success",
          });
          break;

        case "playback_state":
          setIsPlaying(message.isPlaying);
          break;

        case "current_song":
          setCurrentVideoId(message.videoId);
          setCurrentTitle(message.title);
          break;
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (room?.code) {
          connectWebSocket(room.code);
        }
      }, 3000);
    };

    return ws;
  }, [room?.code, toast]);

  const createRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      const newRoom = await response.json();
      setRoom(newRoom);
      connectWebSocket(newRoom.code);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handlePlayPause = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: isPlaying ? "pause" : "play" }));
  };

  const handleSkip = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "skip_song" }));
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const allQueueSongs = queue;
  const upcomingSongs = queue.filter((item) => item.status === "waiting");

  if (!room) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4 text-center">
          <Music className="w-16 h-16 mx-auto mb-6 text-primary" />
          <h1 className="text-3xl font-bold mb-4">Karaoke TV</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Create a room to start your karaoke session
          </p>
          <Button
            size="lg"
            onClick={createRoom}
            disabled={isCreatingRoom}
            data-testid="button-create-room"
            className="w-full text-lg py-6"
          >
            {isCreatingRoom ? "Creating..." : "Create Room"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex">
      <div className="flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Music className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold">Karaoke</h1>
          </div>
          <div
            className="flex items-center gap-3 bg-card px-6 py-3 rounded-lg"
            data-testid="display-room-code"
          >
            <Users className="w-6 h-6 text-muted-foreground" />
            <span className="text-muted-foreground text-lg">Join:</span>
            <span className="text-4xl font-bold tracking-wider text-primary">
              {room.code}
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {currentVideoId ? (
            <div className="w-full max-w-5xl">
              <div
                ref={playerContainerRef}
                className="relative w-full"
                style={{ paddingBottom: "56.25%" }}
              >
                <div
                  id="youtube-player"
                  className="absolute inset-0 w-full h-full rounded-lg overflow-hidden"
                  data-testid="video-player"
                />
              </div>
            </div>
          ) : (
            <div
              className="text-center p-12"
              data-testid="display-empty-state"
            >
              <Music className="w-24 h-24 mx-auto mb-6 text-muted-foreground opacity-50" />
              <h2 className="text-3xl font-bold mb-4">No Songs in Queue</h2>
              <p className="text-xl text-muted-foreground">
                Scan the room code with your phone to add songs
              </p>
            </div>
          )}
        </div>

        {currentVideoId && (
          <div
            className="fixed bottom-0 left-0 right-80 bg-card/95 backdrop-blur border-t border-border p-4"
            data-testid="playback-controls"
          >
            <div className="flex items-center justify-between max-w-5xl mx-auto gap-4">
              <div className="flex-1 min-w-0">
                <p
                  className="text-lg font-medium truncate"
                  data-testid="text-current-song"
                >
                  {currentTitle || "Unknown Song"}
                </p>
                <p className="text-sm text-muted-foreground">Now Playing</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handlePlayPause}
                  data-testid="button-play-pause"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleSkip}
                  data-testid="button-skip"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="w-80 bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-bold">Queue</h2>
          <p className="text-sm text-muted-foreground">
            {allQueueSongs.length} song{allQueueSongs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {allQueueSongs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Queue is empty</p>
              </div>
            ) : (
              allQueueSongs.map((item, index) => (
                <Card
                  key={item.id}
                  className={`p-3 flex gap-3 items-center hover-elevate transition-all ${item.status === 'playing' ? 'border-primary border-2' : ''}`}
                  data-testid={`card-queue-item-${item.id}`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${item.status === 'playing' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {item.status === 'playing' ? (
                      <Music className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-16 h-12 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm truncate"
                      data-testid={`text-queue-title-${item.id}`}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2">
                      {item.status === 'playing' && (
                        <span className="text-xs text-primary font-medium">Now Playing</span>
                      )}
                      {item.duration && (
                        <p className="text-xs text-muted-foreground">
                          {item.duration}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}
