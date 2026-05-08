import { execFile } from "child_process";
import { unlinkSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { Router } from "express";
import multer from "multer";
import FormData from "form-data";

const execFileAsync = promisify(execFile);
const voiceRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ELEVENLABS_API_KEY = process.env["ELEVENLABS_API_KEY"] ?? "";
const VOICE_ID = "erXw76RvabIuWST2abio";
const MODEL_ID = "eleven_multilingual_v2";

const EFFECTS: Record<string, string> = {
  robot:     "aecho=0.8:0.88:30:0.5,vibrato=f=20:d=0.5,asetrate=40000,aresample=44100",
  deep:      "asetrate=30000,aresample=44100",
  chipmunk:  "asetrate=70000,aresample=44100",
  female:    "asetrate=56000,aresample=44100",
  alien:     "asetrate=26000,aresample=44100,vibrato=f=8:d=1,aecho=0.8:0.7:200:0.5",
  echo:      "aecho=0.8:0.9:500:0.4,aecho=0.7:0.8:1000:0.2",
  cave:      "aecho=0.9:0.9:200:0.3,aecho=0.8:0.85:700:0.2,aecho=0.7:0.8:1500:0.1",
  demon:     "asetrate=22000,aresample=44100,aecho=0.9:0.8:80:0.6",
  radio:     "highpass=f=300,lowpass=f=3400,aecho=0.6:0.5:10:0.3,volume=2",
  whisper:   "volume=0.4,highpass=f=1000,aecho=0.5:0.4:30:0.2",
};

async function applyFFmpegEffect(buffer: Buffer, mimeType: string, effect: string): Promise<Buffer> {
  const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";
  const tmpIn  = join(tmpdir(), `vc_in_${Date.now()}.${ext}`);
  const tmpOut = join(tmpdir(), `vc_out_${Date.now()}.mp3`);

  try {
    writeFileSync(tmpIn, buffer);
    const filter = EFFECTS[effect] ?? EFFECTS.echo;
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn,
      "-af", filter,
      "-codec:a", "libmp3lame",
      "-q:a", "2",
      "-ar", "44100",
      tmpOut,
    ]);
    return readFileSync(tmpOut);
  } finally {
    try { unlinkSync(tmpIn); } catch {}
    try { unlinkSync(tmpOut); } catch {}
  }
}

voiceRouter.post("/effects", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No audio file." }); return; }
    const effect = (req.body.effect as string) ?? "echo";
    if (!EFFECTS[effect]) { res.status(400).json({ error: `Unknown effect: ${effect}` }); return; }

    const outputBuffer = await applyFFmpegEffect(req.file.buffer, req.file.mimetype, effect);
    res.json({ audio: outputBuffer.toString("base64"), mimeType: "audio/mpeg" });
  } catch (err) {
    req.log.error({ err }, "FFmpeg effect failed");
    res.status(500).json({ error: "Effect processing failed." });
  }
});

voiceRouter.post("/speech-to-speech", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No audio file." }); return; }
    if (!ELEVENLABS_API_KEY) { res.status(500).json({ error: "ElevenLabs key not configured." }); return; }

    const form = new FormData();
    form.append("audio", req.file.buffer, {
      filename: req.file.originalname || "recording.m4a",
      contentType: req.file.mimetype || "audio/m4a",
    });
    form.append("model_id", MODEL_ID);
    form.append("voice_settings", JSON.stringify({
      stability: 0.4,
      similarity_boost: 0.85,
      style: 0.0,
      use_speaker_boost: true,
    }));

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/speech-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, ...form.getHeaders() },
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
    res.json({ audio: audioBuffer.toString("base64"), mimeType: "audio/mpeg" });
  } catch (err) {
    req.log.error({ err }, "Speech-to-speech failed");
    res.status(500).json({ error: "Conversion failed." });
  }
});

export default voiceRouter;
