// TANOMATE win counter. GET returns the count, POST adds one win and returns the new count.
// Uses the Redis database connected in Vercel's Storage tab (it sets REDIS_URL for us).
import { createClient } from "redis";

const KEY = "tanomate:wins";
const IP_WINDOW_S = 6 * 60 * 60;   // one counted win per visitor IP every 6 hours, so nobody can spam it

let client;
async function redis() {
  if (client && client.isOpen) return client;
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) throw new Error("No REDIS_URL set");
  client = createClient({ url, socket: { connectTimeout: 4000 } });
  client.on("error", () => {});
  await client.connect();
  return client;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const r = await redis();
    if (req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const fresh = await r.set(`tanomate:ip:${ip}`, "1", { NX: true, EX: IP_WINDOW_S });
      const count = fresh ? await r.incr(KEY) : Number((await r.get(KEY)) || 0);
      return res.status(200).json({ count, counted: !!fresh });
    }
    return res.status(200).json({ count: Number((await r.get(KEY)) || 0) });
  } catch (e) {
    return res.status(503).json({ error: "counter unavailable" });
  }
}
