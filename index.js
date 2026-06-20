const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const axios = require("axios");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/clip", async (req, res) => {
  const { videoUrl, startTime, endTime, watermark } = req.body;

  if (!videoUrl || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing videoUrl, startTime, or endTime" });
  }

  const tmpInput  = path.join("/tmp", `input-${Date.now()}.mp4`);
  const tmpOutput = path.join("/tmp", `output-${Date.now()}.mp4`);

  try {
    // Download video from Mux
    const response = await axios({ url: videoUrl, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(tmpInput);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Clip with FFmpeg
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(tmpInput)
        .setStartTime(startTime)
        .setDuration(getDuration(startTime, endTime))
        .output(tmpOutput)
        .videoCodec("libx264")
        .audioCodec("aac");

      // Add watermark for free users
      if (watermark) {
        cmd = cmd.videoFilters(
  "drawtext=text='clipstorm.ai':fontcolor=white:fontsize=24:alpha=0.6:x=w-tw-20:y=h-th-20:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
);
        );
      }

      cmd.on("end", resolve).on("error", reject).run();
    });

    // Send the clipped file
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="clip.mp4"`);
    fs.createReadStream(tmpOutput).pipe(res);

  } catch (err) {
    console.error("Clip error:", err);
    res.status(500).json({ error: "Clipping failed." });
  } finally {
    // Cleanup temp files
    setTimeout(() => {
      if (fs.existsSync(tmpInput))  fs.unlinkSync(tmpInput);
      if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
    }, 5000);
  }
});

function getDuration(start, end) {
  const toSeconds = (t) => {
    const parts = t.split(":").map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };
  return toSeconds(end) - toSeconds(start);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Clipper running on port ${PORT}`));