// sanity/lib/live.ts

// In next-sanity v11+, defineLive must be imported from "next-sanity/live"
import { defineLive } from "next-sanity/live";
import { client } from "./client";

export const { sanityFetch, SanityLive } = defineLive({
  client: client.withConfig({
    // Keep your API version (use a real version like "2024-10-01")
    apiVersion: "2024-05-01"
  })
});