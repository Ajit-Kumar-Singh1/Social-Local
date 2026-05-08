import { Router } from "express";
import { GenerateImageBody } from "../schemas.js";

const router = Router();

router.post("/images/generate", async (req, res): Promise<void> => {
  const parsed = GenerateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, style } = parsed.data;
  const fullPrompt = style ? `${prompt}, ${style} style` : prompt;

  try {
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.HUGGING_FACE_API_KEY
            ? { Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: { num_inference_steps: 20, guidance_scale: 7.5 },
        }),
      }
    );

    if (!hfRes.ok) {
      const encodedPrompt = encodeURIComponent(fullPrompt.slice(0, 100));
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
      res.json({ imageUrl: fallbackUrl, prompt: fullPrompt });
      return;
    }

    const imageBuffer = await hfRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    res.json({ imageUrl, prompt: fullPrompt });
  } catch {
    const encodedPrompt = encodeURIComponent(fullPrompt.slice(0, 100));
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
    res.json({ imageUrl: fallbackUrl, prompt: fullPrompt });
  }
});

export default router;
