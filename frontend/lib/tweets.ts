// This file can be used for tweet-related utilities in the future
// Currently not needed since we're using manual tweet data

export function extractTweetId(url: string): string | null {
  try {
    const u = new URL(url);
    // Works for x.com or twitter.com
    // Format: /{user}/status/{id}
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "status");
    if (idx !== -1 && parts[idx + 1]) {
      const id = parts[idx + 1].split("?")[0];
      return /^\d+$/.test(id) ? id : null;
    }
    return null;
  } catch {
    return null;
  }
}
