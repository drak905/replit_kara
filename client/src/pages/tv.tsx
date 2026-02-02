import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, SkipForward, Music, Users, Star } from "lucide-react";
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
  const [showScore, setShowScore] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const applauseRef = useRef<HTMLAudioElement | null>(null);

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
    if (!ytReady || !playerContainerRef.current) return;
    
    if (!currentVideoId) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      return;
    }

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
            handleVideoEnd();
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

  const handleVideoEnd = () => {
    const score = Math.floor(Math.random() * 51) + 50;
    setCurrentScore(score);
    setShowScore(true);
    
    if (applauseRef.current) {
      applauseRef.current.currentTime = 0;
      applauseRef.current.play().catch(() => {});
    }
    
    setTimeout(() => {
      setShowScore(false);
      handleSkip();
    }, 4000);
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
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <audio
        ref={applauseRef}
        src="https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"
        preload="auto"
      />
      
      {showScore && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          data-testid="score-overlay"
        >
          <div className="text-center animate-in zoom-in-50 duration-500">
            <div className="flex justify-center gap-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-12 h-12 ${currentScore >= 60 + i * 10 ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} 
                />
              ))}
            </div>
            <p className="text-8xl font-bold text-primary mb-4" data-testid="text-score">
              {currentScore}
            </p>
            <p className="text-3xl text-muted-foreground">Great Performance!</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-4 border-b border-border">
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

      <div className="flex-1 flex flex-col">
        {currentVideoId ? (
          <div className="w-full px-4 pt-4">
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
            
            <div
              className="flex items-center justify-between mt-4 bg-card rounded-lg p-4 gap-4"
              data-testid="playback-controls"
            >
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
        ) : (
          <div
            className="flex-1 flex items-center justify-center"
            data-testid="display-empty-state"
          >
            <div className="text-center p-12">
              <Music className="w-24 h-24 mx-auto mb-6 text-muted-foreground opacity-50" />
              <h2 className="text-3xl font-bold mb-4">No Songs in Queue</h2>
              <p className="text-xl text-muted-foreground">
                Scan the room code with your phone to add songs
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-border bg-card mt-auto">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h2 className="text-lg font-bold">Up Next</h2>
            <p className="text-sm text-muted-foreground">
              {allQueueSongs.length} song{allQueueSongs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ScrollArea className="h-32">
            <div className="p-3 flex gap-3 overflow-x-auto">
              {allQueueSongs.length === 0 ? (
                <div className="flex items-center justify-center w-full py-4 text-muted-foreground">
                  <Music className="w-6 h-6 mr-2 opacity-50" />
                  <p>Queue is empty - add songs from your phone</p>
                </div>
              ) : (
                allQueueSongs.map((item, index) => (
                  <Card
                    key={item.id}
                    className={`p-2 flex gap-2 items-center shrink-0 w-72 hover-elevate transition-all ${item.status === 'playing' ? 'border-primary border-2' : ''}`}
                    data-testid={`card-queue-item-${item.id}`}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 ${item.status === 'playing' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {item.status === 'playing' ? (
                        <Music className="w-3 h-3" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-9 object-cover rounded shrink-0"
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
                          <span className="text-xs text-primary font-medium">Playing</span>
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
        </div>
      </div>
    </div>
  );
}
