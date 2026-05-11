import { Router } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { GenerateImageBody } from "../schemas.js";

const router = Router();

type Provider = "pollinations" | "huggingface" | "openai" | "gemini";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function getPublicUrl(req: import("express").Request, filename: string): string {
  const base =
    process.env.PUBLIC_URL ??
    (() => {
      const host = req.get("host") ?? `localhost:${process.env.PORT ?? 5000}`;
      const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
      return `${proto}://${host}`;
    })();
  return `${base}/api/uploads/${filename}`;
}

function saveBase64Image(base64Data: string, mimeType: string): string {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : mimeType.includes("webp") ? "webp" : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return filename;
}

async function saveRemoteImage(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return filename;
}

async function generateWithPollinations(prompt: string): Promise<{ filename: string }> {
  const encoded = encodeURIComponent(prompt.slice(0, 200));
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
  const filename = await saveRemoteImage(url);
  return { filename };
}

async function generateWithHuggingFace(prompt: string, model: string): Promise<{ filename: string }> {
  const apiKey = process.env.HUGGING_FACE_API_KEY;
  const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 20, guidance_scale: 7.5 } }),
  });

  if (!hfRes.ok) throw new Error(`HuggingFace error: ${hfRes.status} ${hfRes.statusText}`);
  const contentType = hfRes.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await hfRes.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { filename };
}

async function generateWithOpenAI(prompt: string, model: string, size: string): Promise<{ filename: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const body: Record<string, unknown> = { prompt, model, n: 1, size };
  if (model === "dall-e-3") body.quality = "standard";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { data?: Array<{ url?: string }>; error?: { message: string } };
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "OpenAI API error");
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("No image URL in OpenAI response");

  const filename = await saveRemoteImage(url);
  return { filename };
}

async function generateWithGemini(prompt: string, model: string): Promise<{ filename: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    }
  );

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
    error?: { message: string };
  };

  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Gemini API error");

  const inlineData = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inlineData) throw new Error("No image data in Gemini response");

  const filename = saveBase64Image(inlineData.data, inlineData.mimeType);
  return { filename };
}

router.post("/images/generate", async (req, res): Promise<void> => {
  const parsed = GenerateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, style, provider = "pollinations", model } = parsed.data;
  const fullPrompt = style ? `${prompt}, ${style} style` : prompt;

  const tryGenerate = async (): Promise<{ filename: string; usedProvider: string }> => {
    switch (provider as Provider) {
      case "huggingface": {
        const result = await generateWithHuggingFace(fullPrompt, model ?? "stabilityai/stable-diffusion-xl-base-1.0");
        return { ...result, usedProvider: "huggingface" };
      }
      case "openai": {
        const result = await generateWithOpenAI(fullPrompt, model ?? "dall-e-3", "1024x1024");
        return { ...result, usedProvider: "openai" };
      }
      case "gemini": {
        const result = await generateWithGemini(fullPrompt, model ?? "gemini-2.0-flash-preview-image-generation");
        return { ...result, usedProvider: "gemini" };
      }
      case "pollinations":
      default: {
        const result = await generateWithPollinations(fullPrompt);
        return { ...result, usedProvider: "pollinations" };
      }
    }
  };

  try {
    const { filename, usedProvider } = await tryGenerate();
    const imageUrl = getPublicUrl(req, filename);
    req.log.info({ filename, provider: usedProvider }, "AI image generated and saved");
    res.json({ imageUrl, prompt: fullPrompt, provider: usedProvider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    req.log.warn({ err, provider }, "AI image generation failed, falling back to Pollinations");
    try {
      const { filename } = await generateWithPollinations(fullPrompt);
      const imageUrl = getPublicUrl(req, filename);
      res.json({ imageUrl, prompt: fullPrompt, provider: "pollinations", warning: msg });
    } catch (fallbackErr) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : "Fallback also failed";
      res.status(502).json({ error: `${msg}; fallback failed: ${fallbackMsg}` });
    }
  }
});

export default router;
