import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const facebookPagesTable = pgTable("facebook_pages", {
  id: serial("id").primaryKey(),
  pageId: text("page_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  accessToken: text("access_token").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => facebookPagesTable.id, { onDelete: "cascade" }),
  title: text("title"),
  postType: text("post_type").$type<"text" | "image" | "video">().default("image"),
  caption: text("caption").notNull(),
  imageUrl: text("image_url"),
  audioUrl: text("audio_url"),
  status: text("status").$type<"draft" | "scheduled" | "published" | "failed">().default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  facebookPostId: text("facebook_post_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FacebookPage = typeof facebookPagesTable.$inferSelect;
export type InsertFacebookPage = typeof facebookPagesTable.$inferInsert;
export type Post = typeof postsTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;

const schema = { facebookPagesTable, postsTable };
export const db = drizzle(pool, { schema });
