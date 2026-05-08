import { db, postsTable, facebookPagesTable } from "../db/schema.js";
import { eq, lte, and } from "drizzle-orm";
import { logger } from "./logger.js";
import { cleanupUploadedFile } from "./cleanupUpload.js";
import { publishToFacebook } from "./facebook.js";

async function publishScheduledPosts() {
  const now = new Date();
  const duePosts = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.status, "scheduled"), lte(postsTable.scheduledAt, now)));

  if (duePosts.length === 0) return;

  logger.info({ count: duePosts.length }, "Publishing scheduled posts");

  for (const post of duePosts) {
    const [page] = await db
      .select()
      .from(facebookPagesTable)
      .where(eq(facebookPagesTable.id, post.pageId));

    if (!page) {
      await db
        .update(postsTable)
        .set({ status: "failed", errorMessage: "Facebook page not found" })
        .where(eq(postsTable.id, post.id));
      continue;
    }

    try {
      const fbData = await publishToFacebook(page, post);

      if (fbData.error) {
        await db
          .update(postsTable)
          .set({ status: "failed", errorMessage: fbData.error.message })
          .where(eq(postsTable.id, post.id));
        logger.warn({ postId: post.id, error: fbData.error.message }, "Failed to publish scheduled post");
      } else {
        await db
          .update(postsTable)
          .set({
            status: "published",
            publishedAt: new Date(),
            facebookPostId: fbData.id ?? null,
            errorMessage: null,
          })
          .where(eq(postsTable.id, post.id));
        logger.info({ postId: post.id, facebookPostId: fbData.id }, "Scheduled post published");
        cleanupUploadedFile(post.imageUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await db
        .update(postsTable)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(postsTable.id, post.id));
      logger.error({ err, postId: post.id }, "Error publishing scheduled post");
    }
  }
}

export function startScheduler() {
  logger.info("Post scheduler started — checking every 60 seconds");
  void publishScheduledPosts();
  setInterval(() => void publishScheduledPosts(), 60_000);
}
