import "server-only";
export const runtime = "edge"; // or "nodejs" if needed
export const dynamic = "force-dynamic"; // or "force-static" etc.
// Must be a literal number, not an expression
import { NextResponse } from "next/server";
import { extractTweetId } from "@/lib/tweets";

// In-memory cache
let cache: {
  data: TweetDTO[] | null;
  timestamp: number;
  error: string | null;
} = {
  data: null,
  timestamp: 0,
  error: null,
};

type TweetDTO = {
  id: string;
  text: string;
  url: string;
  author: {
    name: string;
    username: string;
    profile_image_url: string;
    verified?: boolean;
  };
  created_at: string;
};

const TWEET_URLS = [
  "https://x.com/Star_Knight12/status/1969786069823426754",
  "https://x.com/SaidAitmbarek/status/1969829245863281128",
  "https://x.com/0xmitsurii/status/1969833040873746526",
  "https://x.com/iwantMBAm4/status/1969786547382911122",
  "https://x.com/raydotsh/status/1969784668636741728",
  "https://x.com/pankajkumar_dev/status/1969848125637730412",
  "https://x.com/samirande_/status/1969798937705164946",
  "https://x.com/prince981620/status/1969836404504158467",
  "https://x.com/byteHumi/status/1969764448396333279",
  "https://x.com/kaif9998/status/1969830228034834782",
  "https://x.com/YashBudhiya/status/1969783782476501021",
  "https://x.com/NischalShetty02/status/1969791574457631193",
  "https://x.com/Harish_52/status/1969777033715826947",
  "https://x.com/Jagrit_Gumber/status/1969812917265617030",
  "https://x.com/chi_maile/status/1970028028861538731",
  "https://x.com/hhaider__/status/1969807580315992458",
  "https://x.com/mvrckhckr/status/1969844154801828068",
  "https://x.com/koushik_xd/status/1969774228024299610",
  "https://x.com/zzzzshawn/status/1969809666365673843",
  "https://x.com/aeishady/status/1969789297583665626",
  "https://x.com/_harithj/status/1969778581057442017",
  "https://x.com/web3naman/status/1969810149008093429",
  "https://x.com/BhatAasim9/status/1969781380256280757",
  "https://x.com/MaanCore/status/1969785402019172635",
  "https://x.com/_Chandan_17/status/1969965737797403121",
  "https://x.com/BigNewsMg/status/1969782443805978862",
  "https://x.com/notathrv/status/1969774514151039076",
  "https://x.com/ShanmukhDev16/status/1969798323067662391",
  "https://x.com/NabeelHQ/status/1969839761440338388",
  "https://x.com/rohit4verse/status/1969918755678605445",
  "https://x.com/Sonu_Singha_/status/1969790989096391114",
  "https://x.com/Sarabjeet___/status/1969789822639464845",
  "https://x.com/sankitdev/status/1969941183742063076",
  "https://x.com/psomkar1/status/1969779499802730602",
  "https://x.com/itshirdeshk/status/1969979497676988440",
  "https://x.com/ashuuu_soft/status/1970159604425510967",
  "https://x.com/parveen__tyagi/status/1969810188787241189",
  "https://x.com/GhostCoder_/status/1969770088128458759",
  "https://x.com/amaan8429/status/1970060992697757962",
  "https://x.com/anurag__kochar/status/1969806456989077552",
  "https://x.com/TheArnabSaha/status/1969789392245190970",
  "https://x.com/Arpit_2023/status/1969792881281159589",
  "https://x.com/chauhantwts/status/1971042349414482365",
  "https://x.com/builtin2005/status/1969776176387289432",
  "https://x.com/prasoonmahawar/status/1969787976218714577",
  "https://x.com/AdityaKrSi66307/status/1970135504189599908",
  "https://x.com/Chirag_S_kotian/status/1970066947045023828",
  "https://x.com/Divine__Ugorji/status/1969810100874592453",
  "https://x.com/iamAdityaAnjana/status/1970008701361881134",
  "https://x.com/arcbitbit/status/1969951849525674194",
  "https://x.com/girl_gottagrind/status/1970038361877352857",
  "https://x.com/that_tallguy_1/status/1969799185634558456",
  "https://x.com/K_A_I11/status/1969781065146610091",
  "https://x.com/Shivamshahi77/status/1970414959818350813",
  "https://x.com/ReformedTechca/status/1970003405474271397",
  "https://x.com/SinhaKislay/status/1969817692174442515",
  "https://x.com/Chandan_blaster/status/1969788633516474409",
  "https://x.com/jacques_web3/status/1969803670205448441",
  "https://x.com/hon_adutette/status/1970881763829600551",
];

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 1 day
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

export const revalidate = 86400; // 1 day (24 * 60 * 60)

// Fallback data in case API fails completely
const FALLBACK_TWEETS: TweetDTO[] = [
  {
    id: "fallback-1",
    text: "NameHunt is amazing! 🔥 Finally found the perfect domain at the best price.",
    url: "https://x.com/dev_user/status/1234567890",
    author: {
      name: "Developer",
      username: "dev_user",
      profile_image_url:
        "https://pbs.twimg.com/profile_images/default_profile_normal.png",
      verified: false,
    },
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-2",
    text: "This tool saved me so much time comparing domain prices across registrars! ⚡",
    url: "https://x.com/dev_user/status/1234567890",
    author: {
      name: "Entrepreneur",
      username: "startup_founder",
      profile_image_url:
        "https://pbs.twimg.com/profile_images/default_profile_normal.png",
      verified: false,
    },
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-3",
    text: "Love how transparent the pricing is. No hidden fees! 💯",
    url: "https://x.com/dev_user/status/1234567890",
    author: {
      name: "Tech Enthusiast",
      username: "tech_lover",
      profile_image_url:
        "https://pbs.twimg.com/profile_images/default_profile_normal.png",
      verified: false,
    },
    created_at: new Date().toISOString(),
  },
];

async function fetchTweetsFromAPI(): Promise<TweetDTO[]> {
  const ids = TWEET_URLS.map(extractTweetId).filter(Boolean) as string[];
  if (!ids.length) return FALLBACK_TWEETS;

  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error("Missing X_BEARER_TOKEN");
  }

  const endpoint =
    "https://api.x.com/2/tweets?expansions=author_id&tweet.fields=created_at&user.fields=name,username,profile_image_url,verified&ids=" +
    ids.join(",");

  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // Cache at the edge for a bit to reduce rate limits
    next: { revalidate: CACHE_TTL_SECONDS },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} - ${text}`);
  }

  const json = await res.json();

  // Map users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersById = new Map<string, any>();
  for (const u of json.includes?.users ?? []) {
    usersById.set(u.id, u);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tweets: TweetDTO[] = (json.data ?? []).map((t: any) => {
    const u = usersById.get(t.author_id) ?? {};
    return {
      id: t.id,
      text: t.text
        .replace("@abhi__br", "")
        .replace("@adxtya_jha", "")
        .replace("@samirande_", "")
        .replace("@Star_Knight12", "")
        .replace("@0xrinx", ""),
      created_at: t.created_at,
      url: `https://x.com/${u.username}/status/${t.id}`,
      author: {
        name: u.name ?? "",
        username: u.username ?? "",
        profile_image_url:
          u.profile_image_url ??
          "https://pbs.twimg.com/profile_images/default_profile_normal.png",
        verified: !!u.verified,
      },
    };
  });

  return tweets;
}

export async function GET() {
  const now = Date.now();

  // Check if we have valid cached data
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ tweets: cache.data });
  }

  try {
    // Try to fetch fresh data from API
    const tweets = await fetchTweetsFromAPI();

    // Update cache with successful data
    cache = {
      data: tweets,
      timestamp: now,
      error: null,
    };

    return NextResponse.json({ tweets });
  } catch (error) {
    console.error("Failed to fetch tweets:", error);

    // If we have cached data (even if expired), return it
    if (cache.data) {
      console.log("Returning expired cached data due to API error");
      return NextResponse.json({ tweets: cache.data });
    }

    // If no cache and API fails, return fallback data
    console.log("Returning fallback data due to API error");
    return NextResponse.json({ tweets: FALLBACK_TWEETS });
  }
}
