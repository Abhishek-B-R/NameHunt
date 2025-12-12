"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type TweetDTO = {
  id: string;
  text: string;
  url?: string;
  author: {
    name: string;
    username: string;
    profile_image_url: string;
    verified?: boolean;
  };
  created_at: string;
};

// Linkify mentions and URLs
function formatTweetText(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_]+|https?:\/\/[^\s]+)/g);

  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const handle = part.slice(1);
      return (
        <a
          key={i}
          href={`https://x.com/${handle}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith("http")) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// helper to get a circular window of size `size` starting at `start`
function circularWindow<T>(arr: T[], start: number, size: number): T[] {
  const out: T[] = [];
  if (arr.length === 0) return out;
  for (let i = 0; i < size; i++) out.push(arr[(start + i) % arr.length]);
  return out;
}

const CARDS_PER_ROW = 4; // total visible = 3 rows * 3 = 9
const INTERVAL_MS = 2500; // slide every 2.5s

export default function TestimonialsComponent() {
  const [tweets, setTweets] = useState<TweetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // rotation state
  const [startIndex, setStartIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // fetch from your API route
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);

        // session cache to avoid flashing
        const cacheKey = "testimonials-tweets-cache-v1";
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { tweets: TweetDTO[] };
          if (active && parsed?.tweets) setTweets(parsed.tweets);
        }

        const res = await fetch("/api/tweets", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch testimonials");
        const data = await res.json();
        if (active) {
          setTweets(data.tweets ?? []);
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ tweets: data.tweets ?? [] })
          );
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Error fetching testimonials"
          );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  // advance the window
  useEffect(() => {
    if (tweets.length === 0) return;
    if (prefersReducedMotion) return;

    const id = setInterval(() => {
      if (!paused) setStartIndex((s) => (s + CARDS_PER_ROW) % tweets.length);
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [tweets.length, paused, prefersReducedMotion]);

  // Memoized calculations - must be called before any early returns
  const windowSize = CARDS_PER_ROW * 3;
  const visible = useMemo(
    () =>
      circularWindow(tweets, startIndex, Math.min(windowSize, tweets.length)),
    [tweets, startIndex, windowSize]
  );

  // split visible window into 3 rows
  const rows = useMemo(() => {
    const r: TweetDTO[][] = [[], [], []];
    for (let i = 0; i < visible.length; i++) {
      r[Math.floor(i / CARDS_PER_ROW)].push(visible[i]);
    }
    // ensure 3 arrays exist even if less than windowSize tweets
    return r;
  }, [visible]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
        <div className="text-lg text-white/70 mt-4">
          Loading testimonials...
        </div>
      </div>
    );
  }

  if (error || tweets.length === 0) {
    return <></>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8" id="testimonials">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-bold text-white">
          What our actual users say
        </h2>
        <p className="text-white/70 mt-2">Real feedback from 𝕏</p>
      </div>

      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map((row, rIdx) => (
            <div key={rIdx} className="space-y-6">
              {row.map((tweet, i) => (
                <TweetCard
                  key={tweet.id}
                  tweet={tweet}
                  delayMs={prefersReducedMotion ? 0 : i * 120}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TweetCard({
  tweet,
  delayMs = 0,
}: {
  tweet: TweetDTO;
  delayMs?: number;
}) {
  return (
    <div
      className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:bg-white/10
                 shadow-lg transition-all duration-100 ease-out cursor-pointer"
      style={{ transitionDelay: `${delayMs}ms` }}
      onClick={() => {
        if (tweet.url) {
          window.open(tweet.url, "_blank");
        }
      }}
    >
      <div className="flex items-start gap-4 mb-4">
        <Image
          src={tweet.author.profile_image_url}
          alt={tweet.author.name}
          width={48}
          height={48}
          className="w-12 h-12 rounded-full border-2 border-white/20"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white text-sm truncate">
              {tweet.author.name}
            </h3>
          </div>
          <p className="text-sm text-white/70">@{tweet.author.username}</p>
        </div>
      </div>

      <div className="text-white leading-relaxed mb-4 text-sm">
        {formatTweetText(tweet.text)}
      </div>

      <div className="text-xs text-white/60">
        {new Date(tweet.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  const mqlRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    mqlRef.current = mql;
    const handler = () => setReduced(mql.matches);
    handler();
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return reduced;
}
