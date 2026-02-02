import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { Room, QueueItem, WSMessage } from "@shared/schema";
import { z } from "zod";

const addToQueueSchema = z.object({
  videoId: z.string().min(1),
  title: z.string().min(1),
  thumbnail: z.string().min(1),
  channelTitle: z.string().optional(),
  duration: z.string().optional(),
});

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface RoomConnection {
  ws: WebSocket;
  roomId: string;
}

const roomConnections = new Map<string, Set<WebSocket>>();

function broadcastToRoom(roomId: string, message: WSMessage, excludeWs?: WebSocket) {
  const connections = roomConnections.get(roomId);
  if (!connections) return;
  
  const messageStr = JSON.stringify(message);
  connections.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomId: string | null = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;

        switch (message.type) {
          case 'join_room': {
            const room = await storage.getRoomByCode(message.roomCode);
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
              return;
            }

            currentRoomId = room.id;
            
            if (!roomConnections.has(room.id)) {
              roomConnections.set(room.id, new Set());
            }
            roomConnections.get(room.id)!.add(ws);

            const queue = await storage.getQueueByRoomId(room.id);
            
            ws.send(JSON.stringify({
              type: 'room_state',
              room,
              queue
            }));
            break;
          }

          case 'play': {
            if (!currentRoomId) return;
            await storage.updateRoom(currentRoomId, { isPlaying: true });
            broadcastToRoom(currentRoomId, { type: 'playback_state', isPlaying: true });
            break;
          }

          case 'pause': {
            if (!currentRoomId) return;
            await storage.updateRoom(currentRoomId, { isPlaying: false });
            broadcastToRoom(currentRoomId, { type: 'playback_state', isPlaying: false });
            break;
          }

          case 'skip_song': {
            if (!currentRoomId) return;
            
            const room = await storage.getRoom(currentRoomId);
            if (!room) return;

            const queue = await storage.getQueueByRoomId(currentRoomId);
            const currentItem = queue.find(item => item.status === 'playing');
            
            if (currentItem) {
              await storage.removeFromQueue(currentItem.id);
            }

            const nextItem = await storage.getNextInQueue(currentRoomId);
            
            if (nextItem) {
              await storage.updateQueueItem(nextItem.id, { status: 'playing' });
              await storage.updateRoom(currentRoomId, {
                currentVideoId: nextItem.videoId,
                currentVideoTitle: nextItem.title,
                currentVideoThumbnail: nextItem.thumbnail,
                isPlaying: true
              });
              
              const updatedQueue = await storage.getQueueByRoomId(currentRoomId);
              broadcastToRoom(currentRoomId, {
                type: 'current_song',
                videoId: nextItem.videoId,
                title: nextItem.title,
                thumbnail: nextItem.thumbnail
              });
              broadcastToRoom(currentRoomId, { type: 'queue_updated', queue: updatedQueue });
              broadcastToRoom(currentRoomId, { type: 'playback_state', isPlaying: true });
            } else {
              await storage.updateRoom(currentRoomId, {
                currentVideoId: null,
                currentVideoTitle: null,
                currentVideoThumbnail: null,
                isPlaying: false
              });
              
              broadcastToRoom(currentRoomId, {
                type: 'current_song',
                videoId: null,
                title: null,
                thumbnail: null
              });
              broadcastToRoom(currentRoomId, { type: 'queue_updated', queue: [] });
              broadcastToRoom(currentRoomId, { type: 'playback_state', isPlaying: false });
            }
            break;
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      if (currentRoomId) {
        const connections = roomConnections.get(currentRoomId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            roomConnections.delete(currentRoomId);
          }
        }
      }
    });
  });

  app.post('/api/rooms', async (req, res) => {
    try {
      let code = generateRoomCode();
      let existingRoom = await storage.getRoomByCode(code);
      while (existingRoom) {
        code = generateRoomCode();
        existingRoom = await storage.getRoomByCode(code);
      }

      const room = await storage.createRoom({
        code,
        currentVideoId: null,
        currentVideoTitle: null,
        currentVideoThumbnail: null,
        isPlaying: false
      });

      res.json(room);
    } catch (error) {
      console.error('Error creating room:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  app.get('/api/rooms/:code', async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const queue = await storage.getQueueByRoomId(room.id);
      res.json({ room, queue });
    } catch (error) {
      console.error('Error fetching room:', error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  app.get('/api/youtube/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'YouTube API key not configured' });
      }

      const searchQuery = `${query} karaoke`;
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
      
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`YouTube API error: ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();
      
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${apiKey}`;
      
      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        throw new Error(`YouTube API error: ${detailsResponse.status}`);
      }
      
      const detailsData = await detailsResponse.json();
      
      const results = detailsData.items.map((item: any) => ({
        videoId: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        channelTitle: item.snippet.channelTitle,
        duration: parseDuration(item.contentDetails.duration)
      }));

      res.json(results);
    } catch (error) {
      console.error('Error searching YouTube:', error);
      res.status(500).json({ error: 'Failed to search YouTube' });
    }
  });

  app.post('/api/rooms/:code/queue', async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const validation = addToQueueSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Missing required fields', details: validation.error.issues });
      }
      
      const { videoId, title, thumbnail, channelTitle, duration } = validation.data;

      const maxPosition = await storage.getMaxPosition(room.id);
      const isFirstSong = maxPosition === 0;
      
      const queueItem = await storage.addToQueue({
        roomId: room.id,
        videoId,
        title,
        thumbnail,
        channelTitle: channelTitle || null,
        duration: duration || null,
        position: maxPosition + 1,
        status: isFirstSong ? 'playing' : 'waiting'
      });

      if (isFirstSong) {
        await storage.updateRoom(room.id, {
          currentVideoId: videoId,
          currentVideoTitle: title,
          currentVideoThumbnail: thumbnail,
          isPlaying: true
        });

        broadcastToRoom(room.id, {
          type: 'current_song',
          videoId,
          title,
          thumbnail
        });
        broadcastToRoom(room.id, { type: 'playback_state', isPlaying: true });
      }

      const queue = await storage.getQueueByRoomId(room.id);
      
      broadcastToRoom(room.id, { type: 'song_added', song: queueItem });
      broadcastToRoom(room.id, { type: 'queue_updated', queue });

      res.json(queueItem);
    } catch (error) {
      console.error('Error adding to queue:', error);
      res.status(500).json({ error: 'Failed to add to queue' });
    }
  });

  app.delete('/api/queue/:id', async (req, res) => {
    try {
      await storage.removeFromQueue(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing from queue:', error);
      res.status(500).json({ error: 'Failed to remove from queue' });
    }
  });

  return httpServer;
}

function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
