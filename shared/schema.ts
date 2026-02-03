import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 6 }).notNull().unique(),
  currentVideoId: varchar("current_video_id"),
  currentVideoTitle: text("current_video_title"),
  currentVideoThumbnail: text("current_video_thumbnail"),
  isPlaying: boolean("is_playing").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const queueItems = pgTable("queue_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  videoId: varchar("video_id").notNull(),
  title: text("title").notNull(),
  thumbnail: text("thumbnail").notNull(),
  channelTitle: text("channel_title"),
  duration: varchar("duration"),
  position: integer("position").notNull(),
  status: varchar("status", { length: 20 }).default("waiting"),
  addedAt: timestamp("added_at").defaultNow(),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
  queueItems: many(queueItems),
}));

export const queueItemsRelations = relations(queueItems, ({ one }) => ({
  room: one(rooms, {
    fields: [queueItems.roomId],
    references: [rooms.id],
  }),
}));

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
});

export const insertQueueItemSchema = createInsertSchema(queueItems).omit({
  id: true,
  addedAt: true,
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type QueueItem = typeof queueItems.$inferSelect;
export type InsertQueueItem = z.infer<typeof insertQueueItemSchema>;

export const videoSearchResultSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  thumbnail: z.string(),
  channelTitle: z.string(),
  duration: z.string().optional(),
});

export type VideoSearchResult = z.infer<typeof videoSearchResultSchema>;

export const connectedDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["tv", "mobile"]),
  joinedAt: z.string(),
});

export type ConnectedDevice = z.infer<typeof connectedDeviceSchema>;

export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join_room"), roomCode: z.string(), deviceName: z.string().optional(), deviceType: z.enum(["tv", "mobile"]).optional() }),
  z.object({ type: z.literal("room_state"), room: z.any(), queue: z.array(z.any()), devices: z.array(connectedDeviceSchema).optional() }),
  z.object({ type: z.literal("queue_updated"), queue: z.array(z.any()) }),
  z.object({ type: z.literal("song_added"), song: z.any() }),
  z.object({ type: z.literal("song_removed"), songId: z.string() }),
  z.object({ type: z.literal("playback_state"), isPlaying: z.boolean() }),
  z.object({ type: z.literal("current_song"), videoId: z.string().nullable(), title: z.string().nullable(), thumbnail: z.string().nullable() }),
  z.object({ type: z.literal("skip_song") }),
  z.object({ type: z.literal("remove_song"), songId: z.string() }),
  z.object({ type: z.literal("play") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("devices_updated"), devices: z.array(connectedDeviceSchema) }),
  z.object({ type: z.literal("device_joined"), device: connectedDeviceSchema }),
  z.object({ type: z.literal("device_left"), deviceId: z.string(), deviceName: z.string() }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;
