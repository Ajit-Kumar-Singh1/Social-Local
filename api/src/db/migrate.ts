import { pool } from "./schema.js";
import { logger } from "../lib/logger.js";

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS facebook_pages (
        id          SERIAL PRIMARY KEY,
        page_id     TEXT    NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        category    TEXT,
        access_token TEXT   NOT NULL,
        avatar_url  TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS posts (
        id                SERIAL PRIMARY KEY,
        page_id           INTEGER NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
        title             TEXT,
        post_type         TEXT DEFAULT 'image',
        caption           TEXT NOT NULL,
        image_url         TEXT,
        media_prompt      TEXT,
        audio_url         TEXT,
        status            TEXT NOT NULL DEFAULT 'draft',
        scheduled_at      TIMESTAMP,
        published_at      TIMESTAMP,
        facebook_post_id  TEXT,
        error_message     TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_prompt TEXT;
    `);
    logger.info("Database tables ready");
  } catch (err) {
    logger.error({ err }, "Failed to initialize database tables");
    throw err;
  } finally {
    client.release();
  }
}
