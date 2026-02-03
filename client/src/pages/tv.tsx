import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, SkipForward, Music, Users, Star, Smartphone } from "lucide-react";
import type { Room, QueueItem } from "@shared/schema";
import { useLanguage } from "@/lib/useLanguage";
import { QRCodeSVG } from "qrcode.react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function TVPage() {
  const { toast } = useToast();
  const { language, toggleLanguage, t } = useLanguage();
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
  const scoreInProgressRef = useRef(false);

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
    if (!ytReady) return;
    
    if (!currentVideoId) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      return;
    }

    if (!playerContainerRef.current) return;

    if (playerRef.current) {
      try {
        playerRef.current.loadVideoById(currentVideoId);
        if (isPlaying) {
          playerRef.current.playVideo();
        }
      } catch (e) {}
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
            title: t.addedToQueue,
            description: message.song.title,
            className: "bg-success text-success-foreground border-success",
            duration: 5000,
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
        title: t.error,
        description: t.failedToCreateRoom,
        variant: "destructive",
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handlePlayPause = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      wsRef.current.send(JSON.stringify({ type: isPlaying ? "pause" : "play" }));
    } catch (e) {}
  };

  const handleSkip = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      wsRef.current.send(JSON.stringify({ type: "skip_song" }));
    } catch (e) {}
  };

  const handleVideoEnd = () => {
    if (scoreInProgressRef.current) return;
    scoreInProgressRef.current = true;
    
    const score = Math.floor(Math.random() * 51) + 50;
    setCurrentScore(score);
    setShowScore(true);
    
    if (applauseRef.current) {
      applauseRef.current.currentTime = 0;
      applauseRef.current.play().catch(() => {});
    }
    
    setTimeout(() => {
      setShowScore(false);
      scoreInProgressRef.current = false;
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
      <div className="dark min-h-screen bg-black flex items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          className="absolute top-4 right-4 font-bold"
          data-testid="button-language-toggle"
        >
          {language === 'vi' ? 'VI' : 'EN'}
        </Button>
        <Card className="p-8 max-w-md w-full mx-4 text-center">
          <Music className="w-16 h-16 mx-auto mb-6 text-primary" />
          <h1 className="text-3xl font-bold mb-4">{t.karaokeTV}</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            {t.createRoomDescription}
          </p>
          <Button
            size="lg"
            onClick={createRoom}
            disabled={isCreatingRoom}
            data-testid="button-create-room"
            className="w-full text-lg py-6"
          >
            {isCreatingRoom ? t.creating : t.createRoom}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-black text-foreground flex flex-col">
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
            <p className="text-3xl text-muted-foreground">{t.greatPerformance}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Music className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">{t.karaoke}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="font-bold"
            data-testid="button-language-toggle"
          >
            {language === 'vi' ? 'VI' : 'EN'}
          </Button>
          <div
            className="flex items-center gap-4 bg-card px-4 py-2 rounded-lg"
            data-testid="display-room-code"
          >
            <div className="bg-white p-1.5 rounded-lg" data-testid="qr-code-header">
              <QRCodeSVG
                value={`${window.location.origin}/mobile?room=${room.code}`}
                size={48}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{t.scanToJoin}</span>
              <span className="text-3xl font-bold tracking-wider text-primary">
                {room.code}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className={`w-full px-4 pt-4 ${!currentVideoId ? 'hidden' : ''}`}>
          <div
            ref={playerContainerRef}
            className="relative w-full"
            style={{ paddingBottom: "56.25%" }}
          >
            <div
              id="youtube-player"
              className="absolute inset-0 w-full h-full rounded-lg overflow-hidden bg-black"
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
                {currentTitle || t.unknownSong}
              </p>
              <p className="text-sm text-muted-foreground">{t.nowPlaying}</p>
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
        
        <div
          className={`flex-1 flex items-center justify-center ${currentVideoId ? 'hidden' : ''}`}
          data-testid="display-empty-state"
        >
          <div className="text-center p-12">
            <div className="bg-white p-6 rounded-2xl inline-block mb-6" data-testid="qr-code-container">
              <QRCodeSVG
                value={`${window.location.origin}/mobile?room=${room.code}`}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <h2 className="text-3xl font-bold mb-2">{t.scanToJoin}</h2>
            <p className="text-xl text-muted-foreground mb-4">
              {t.orEnterCode}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-bold tracking-wider text-primary">
                {room.code}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card mt-auto">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h2 className="text-lg font-bold">{t.upNext}</h2>
            <p className="text-sm text-muted-foreground">
              {allQueueSongs.length} {allQueueSongs.length !== 1 ? t.songs : t.song}
            </p>
          </div>
          <ScrollArea className="h-32">
            <div className="p-3 flex gap-3 overflow-x-auto">
              {allQueueSongs.length === 0 ? (
                <div className="flex items-center justify-center w-full py-4 text-muted-foreground">
                  <Music className="w-6 h-6 mr-2 opacity-50" />
                  <p>{t.queueEmpty}</p>
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
                          <span className="text-xs text-primary font-medium">{t.playing}</span>
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
