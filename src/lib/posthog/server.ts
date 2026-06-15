import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getServerPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side event and flush immediately (serverless-safe).
 */
export async function captureServer(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>
) {
  const ph = getServerPostHog();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
  try {
    await ph.flush();
  } catch {
    // best-effort
  }
}
