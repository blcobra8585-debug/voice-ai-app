import { Router } from "express";
import multer from "multer";
import FormData from "form-data";

const voiceRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ELEVENLABS_API_KEY = process.env["ELEVENLABS_API_KEY"] ?? "";
const VOICE_ID = "EXAVITQu4vr4xnNLhMaY";
const MODEL_ID = "eleven_turbo_v2_5";

voiceRouter.post(
  "/speech-to-speech",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided." });
        return;
      }

      if (!ELEVENLABS_API_KEY) {
        res.status(500).json({ error: "ElevenLabs API key not configured." });
        return;
      }

      const form = new FormData();
      form.append("audio", req.file.buffer, {
        filename: req.file.originalname || "recording.m4a",
        contentType: req.file.mimetype || "audio/m4a",
      });
      form.append("model_id", MODEL_ID);
      form.append("voice_settings", JSON.stringify({
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      }));

      const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/speech-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            ...form.getHeaders(),
          },
          body: form.getBuffer(),
        }
      );

      if (!elevenRes.ok) {
        const errText = await elevenRes.text();
        req.log.error({ status: elevenRes.status, body: errText }, "ElevenLabs error");
        res.status(elevenRes.status).json({ error: errText });
        return;
      }

      const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
      const audioBase64 = audioBuffer.toString("base64");

      res.json({ audio: audioBase64, mimeType: "audio/mpeg" });
    } catch (err) {
      req.log.error({ err }, "Voice conversion failed");
      res.status(500).json({ error: "Internal server error during voice conversion." });
    }
  }
);

export default voiceRouter;
