// src/lib/kv.ts
import { createClient } from "@vercel/kv";

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error("Vercel KV environment variables are not correctly set.");
}

export const kv = createClient({
  // ★★★ KV_URL から KV_REST_API_URL に変更 ★★★
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
