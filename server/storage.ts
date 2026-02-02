import { 
  rooms, queueItems,
  type Room, type InsertRoom,
  type QueueItem, type InsertQueueItem
} from "@shared/schema";
import { db } from "./db";
import { eq, asc } from "drizzle-orm";

export interface IStorage {
  createRoom(room: InsertRoom): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getRoom(id: string): Promise<Room | undefined>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  
  addToQueue(item: InsertQueueItem): Promise<QueueItem>;
  getQueueByRoomId(roomId: string): Promise<QueueItem[]>;
  getNextInQueue(roomId: string): Promise<QueueItem | undefined>;
  removeFromQueue(id: string): Promise<void>;
  updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<QueueItem | undefined>;
  clearQueue(roomId: string): Promise<void>;
  getMaxPosition(roomId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db.insert(rooms).values(insertRoom).returning();
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    return room || undefined;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const [room] = await db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, id))
      .returning();
    return room || undefined;
  }

  async addToQueue(item: InsertQueueItem): Promise<QueueItem> {
    const [queueItem] = await db.insert(queueItems).values(item).returning();
    return queueItem;
  }

  async getQueueByRoomId(roomId: string): Promise<QueueItem[]> {
    return db
      .select()
      .from(queueItems)
      .where(eq(queueItems.roomId, roomId))
      .orderBy(asc(queueItems.position));
  }

  async getNextInQueue(roomId: string): Promise<QueueItem | undefined> {
    const queue = await this.getQueueByRoomId(roomId);
    const waitingItems = queue.filter(item => item.status === 'waiting');
    return waitingItems[0];
  }

  async removeFromQueue(id: string): Promise<void> {
    await db.delete(queueItems).where(eq(queueItems.id, id));
  }

  async updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<QueueItem | undefined> {
    const [item] = await db
      .update(queueItems)
      .set(updates)
      .where(eq(queueItems.id, id))
      .returning();
    return item || undefined;
  }

  async clearQueue(roomId: string): Promise<void> {
    await db.delete(queueItems).where(eq(queueItems.roomId, roomId));
  }

  async getMaxPosition(roomId: string): Promise<number> {
    const queue = await this.getQueueByRoomId(roomId);
    if (queue.length === 0) return 0;
    return Math.max(...queue.map(item => item.position));
  }
}

export const storage = new DatabaseStorage();
