import { Router } from "express";
import { GenerateImageBody } from "../schemas.js";

const router = Router();

type Provider = "pollinations" | "huggingface" | "openai" | "gemini";

async function generateWithPollinations(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt.slice(0, 200));
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
}

async function generateWithHuggingFace(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.HUGGING_FACE_API_KEY;
  const hfRes = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { num_inference_steps: 20, guidance_scale: 7.5 },
      }),
    }
  );

  if (!hfRes.ok) throw new Error(`HuggingFace error: ${hfRes.status} ${hfRes.statusText}`);
  const imageBuffer = await hfRes.arrayBuffer();
  return `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString("base64")}`;
}

async function generateWithOpenAI(prompt: string, model: string, size: string): Promise<string> {
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
  return url;
}

async function generateWithGemini(prompt: string, model: string): Promise<string> {
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

  return `data:${inlineData.mimeType};base64,${inlineData.data}`;
}

router.post("/images/generate", async (req, res): Promise<void> => {
  const parsed = GenerateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, style, provider = "pollinations", model } = parsed.data;
  const fullPrompt = style ? `${prompt}, ${style} style` : prompt;

  try {
    let imageUrl: string;

    switch (provider as Provider) {
      case "huggingface": {
        const hfModel = model ?? "stabilityai/stable-diffusion-xl-base-1.0";
        imageUrl = await generateWithHuggingFace(fullPrompt, hfModel);
        break;
      }
      case "openai": {
        const oaiModel = model ?? "dall-e-3";
        const size = oaiModel === "dall-e-3" ? "1024x1024" : "1024x1024";
        imageUrl = await generateWithOpenAI(fullPrompt, oaiModel, size);
        break;
      }
      case "gemini": {
        const geminiModel = model ?? "gemini-2.0-flash-preview-image-generation";
        imageUrl = await generateWithGemini(fullPrompt, geminiModel);
        break;
      }
      case "pollinations":
      default: {
        imageUrl = await generateWithPollinations(fullPrompt);
        break;
      }
    }

    res.json({ imageUrl, prompt: fullPrompt, provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    req.log.warn({ err, provider }, "AI image generation failed, falling back to Pollinations");
    const fallbackUrl = await generateWithPollinations(fullPrompt);
    res.json({ imageUrl: fallbackUrl, prompt: fullPrompt, provider: "pollinations", warning: msg });
  }
});

export default router;
