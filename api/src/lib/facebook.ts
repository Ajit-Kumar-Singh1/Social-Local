import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

type PostData = {
  id: number;
  postType: string | null;
  caption: string;
  imageUrl: string | null;
  title: string | null;
};

type PageData = {
  pageId: string;
  accessToken: string;
};

export type FbResult = {
  id?: string;
  error?: { message: string; code?: number };
};

function getLocalFilePath(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/api\/uploads\/([^?#/]+)$/);
  if (!match) return null;
  const filename = path.basename(match[1]!);
  const filePath = path.resolve(process.cwd(), "uploads", filename);
  return fs.existsSync(filePath) ? filePath : null;
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "avi") return "video/avi";
  return "application/octet-stream";
}

async function postJson(url: string, body: Record<string, string>): Promise<FbResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<FbResult>;
}

async function postMultipart(url: string, fields: Record<string, string>, filePath: string): Promise<FbResult> {
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const mime = mimeFromPath(filePath);
  form.append("source", new Blob([fileBuffer], { type: mime }), path.basename(filePath));
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  const res = await fetch(url, { method: "POST", body: form });
  return res.json() as Promise<FbResult>;
}

export async function publishToFacebook(page: PageData, post: PostData): Promise<FbResult> {
  const postType = post.postType ?? "text";

  if (postType === "image" && post.imageUrl) {
    const localPath = getLocalFilePath(post.imageUrl);
    if (localPath) {
      logger.info({ postId: post.id, localPath }, "Binary-uploading image to Facebook");
      return postMultipart(
        `https://graph.facebook.com/v19.0/${page.pageId}/photos`,
        { caption: post.caption, access_token: page.accessToken },
        localPath,
      );
    }
    return postJson(`https://graph.facebook.com/v19.0/${page.pageId}/photos`, {
      url: post.imageUrl,
      caption: post.caption,
      access_token: page.accessToken,
    });
  }

  if (postType === "video" && post.imageUrl) {
    const localPath = getLocalFilePath(post.imageUrl);
    if (localPath) {
      logger.info({ postId: post.id, localPath }, "Binary-uploading video to Facebook");
      const fields: Record<string, string> = {
        description: post.caption,
        access_token: page.accessToken,
      };
      if (post.title) fields.title = post.title;
      return postMultipart(
        `https://graph.facebook.com/v19.0/${page.pageId}/videos`,
        fields,
        localPath,
      );
    }
    const body: Record<string, string> = {
      file_url: post.imageUrl,
      description: post.caption,
      access_token: page.accessToken,
    };
    if (post.title) body.title = post.title;
    return postJson(`https://graph.facebook.com/v19.0/${page.pageId}/videos`, body);
  }

  return postJson(`https://graph.facebook.com/v19.0/${page.pageId}/feed`, {
    message: post.caption,
    access_token: page.accessToken,
  });
}
