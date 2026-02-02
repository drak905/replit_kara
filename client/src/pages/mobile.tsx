import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Mic, Plus, Music, ListMusic, Loader2 } from "lucide-react";
import type { Room, QueueItem, VideoSearchResult } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function MobilePage() {
  const { toast } = useToast();
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VideoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const connectWebSocket = useCallback((code: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", roomCode: code }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "room_state":
          setRoom(message.room);
          setQueue(message.queue);
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

        case "error":
          toast({
            title: "Error",
            description: message.message,
            variant: "destructive",
          });
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

  const handleJoinRoom = async () => {
    if (roomCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-character room code",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch(`/api/rooms/${roomCode.toUpperCase()}`);
      if (!response.ok) {
        throw new Error("Room not found");
      }
      const data = await response.json();
      setRoom(data.room);
      setQueue(data.queue);
      connectWebSocket(roomCode.toUpperCase());
    } catch (error) {
      toast({
        title: "Room Not Found",
        description: "Could not find a room with that code",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      toast({
        title: "Search Failed",
        description: "Could not search for songs",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToQueue = async (video: VideoSearchResult) => {
    if (!room) return;

    setAddingVideoId(video.videoId);
    try {
      await apiRequest("POST", `/api/rooms/${room.code}/queue`, {
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        channelTitle: video.channelTitle,
        duration: video.duration,
      });
      toast({
        title: "Added to Queue",
        description: video.title,
        className: "bg-success text-success-foreground border-success",
      });
    } catch (error) {
      toast({
        title: "Failed to Add",
        description: "Could not add song to queue",
        variant: "destructive",
      });
    } finally {
      setAddingVideoId(null);
    }
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Voice search is not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      recognitionRef.current = null;
      setTimeout(() => {
        handleSearchWithQuery(transcript);
      }, 100);
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
      toast({
        title: "Voice Search Error",
        description: "Could not recognize speech",
        variant: "destructive",
      });
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSearchWithQuery = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      toast({
        title: "Search Failed",
        description: "Could not search for songs",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      recognitionRef.current?.stop();
    };
  }, []);

  const allQueueSongs = queue;
  const waitingSongsCount = queue.filter((item) => item.status === "waiting").length;

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 safe-area-inset">
        <Card className="w-full max-w-sm p-6 text-center">
          <Music className="w-16 h-16 mx-auto mb-6 text-primary" />
          <h1 className="text-2xl font-bold mb-2">Join Karaoke</h1>
          <p className="text-muted-foreground mb-6">
            Enter the room code shown on the TV
          </p>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="ABCDEF"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              className="text-center text-2xl font-bold tracking-widest h-14"
              maxLength={6}
              data-testid="input-room-code"
            />
            <Button
              onClick={handleJoinRoom}
              disabled={isJoining || roomCode.length !== 6}
              className="w-full h-12 text-lg"
              data-testid="button-join-room"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                "Join"
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-inset">
      <header className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Music className="w-6 h-6 text-primary" />
            <span className="font-bold">Karaoke</span>
          </div>
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
            <span className="text-sm text-muted-foreground">Room:</span>
            <span className="font-bold text-primary" data-testid="text-room-code">
              {room.code}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 pr-4 h-11"
              data-testid="input-search"
            />
          </div>
          <Button
            size="icon"
            variant={isListening ? "default" : "outline"}
            onClick={startVoiceSearch}
            className="h-11 w-11 shrink-0"
            data-testid="button-voice-search"
          >
            <Mic className={`w-5 h-5 ${isListening ? "animate-pulse" : ""}`} />
          </Button>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="h-11 shrink-0"
            data-testid="button-search"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="w-4 h-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="queue" data-testid="tab-queue">
            <ListMusic className="w-4 h-4 mr-2" />
            Queue ({allQueueSongs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="flex-1 mt-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-4 space-y-3">
              {isSearching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-3 flex gap-3">
                    <Skeleton className="w-24 h-16 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </Card>
                ))
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Search for songs to add to the queue</p>
                </div>
              ) : (
                searchResults.map((video) => (
                  <Card
                    key={video.videoId}
                    className="p-3 flex gap-3 items-start hover-elevate"
                    data-testid={`card-search-result-${video.videoId}`}
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-24 h-16 object-cover rounded shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm line-clamp-2"
                        data-testid={`text-video-title-${video.videoId}`}
                      >
                        {video.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {video.channelTitle}
                      </p>
                      {video.duration && (
                        <p className="text-xs text-muted-foreground">
                          {video.duration}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      onClick={() => handleAddToQueue(video)}
                      disabled={addingVideoId === video.videoId}
                      className="h-11 w-11 shrink-0"
                      data-testid={`button-add-${video.videoId}`}
                    >
                      {addingVideoId === video.videoId ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="queue" className="flex-1 mt-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-4 space-y-3">
              {allQueueSongs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No songs in queue</p>
                  <p className="text-sm mt-1">Search and add songs to get started</p>
                </div>
              ) : (
                allQueueSongs.map((item, index) => (
                  <Card
                    key={item.id}
                    className={`p-3 flex gap-3 items-center ${item.status === 'playing' ? 'border-primary border-2' : ''}`}
                    data-testid={`card-queue-item-${item.id}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${item.status === 'playing' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {item.status === 'playing' ? (
                        <Music className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-16 h-12 object-cover rounded shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className="font-medium text-sm truncate"
                          data-testid={`text-queue-title-${item.id}`}
                        >
                          {item.title}
                        </p>
                        {item.status === 'playing' && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded shrink-0">
                            Now Playing
                          </span>
                        )}
                      </div>
                      {item.channelTitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.channelTitle}
                        </p>
                      )}
                      {item.duration && (
                        <p className="text-xs text-muted-foreground">
                          {item.duration}
                        </p>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
