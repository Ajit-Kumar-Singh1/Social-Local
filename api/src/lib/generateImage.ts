import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Generates an image from a text prompt, saves it to disk, and returns
 * a local /api/uploads/<filename> URL that Facebook can access.
 *
 * Tries HuggingFace SDXL first (if API key is set), falls back to Pollinations.
 * Used by the scheduler at post publish time.
 */
export async function generateAndSaveImage(prompt: string, style?: string | null): Promise<string> {
  const fullPrompt = style ? `${prompt}, ${style} style` : prompt;
  ensureUploadsDir();

  // Try HuggingFace if key is available
  if (process.env.HUGGING_FACE_API_KEY) {
    try {
      const hfRes = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          },
          body: JSON.stringify({
            inputs: fullPrompt,
            parameters: { num_inference_steps: 20, guidance_scale: 7.5 },
          }),
          signal: AbortSignal.timeout(45_000),
        }
      );
      if (hfRes.ok) {
        const contentType = hfRes.headers.get("content-type") ?? "";
        if (contentType.startsWith("image/")) {
          const buffer = Buffer.from(await hfRes.arrayBuffer());
          const ext = contentType.includes("png") ? "png" : "jpg";
          const filename = `${randomUUID()}.${ext}`;
          fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
          return `/api/uploads/${filename}`;
        }
      }
    } catch {
      // fall through to Pollinations
    }
  }

  // Pollinations fallback — download and save for a permanent local URL
  const encoded = encodeURIComponent(fullPrompt.slice(0, 200));
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

  const pollRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(90_000) });
  if (!pollRes.ok) throw new Error(`Image generation failed (Pollinations ${pollRes.status})`);

  const buffer = Buffer.from(await pollRes.arrayBuffer());
  const filename = `${randomUUID()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/api/uploads/${filename}`;
}
