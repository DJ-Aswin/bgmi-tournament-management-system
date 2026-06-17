const crypto = require("crypto");

const KRAFTON_ORIGIN = "https://kraftonindiaesports.com";
const KRAFTON_API_BASE = "https://api.v1.kraftonindiaesports.com/";
const KRAFTON_HMAC_KEY = "4c8f649da4ca09d5dec7433c086ef92f";
const CACHE_TTL_MS = 60 * 60 * 1000;

let bundleCache = { at: 0, x9: [], h9: [], jsPath: null };

function absUrl(path) {
  if (!path || typeof path !== "string") return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${KRAFTON_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function ordinalDay(n) {
  const j = n % 10;
  const k = n % 100;
  if (k > 10 && k < 14) return `${n}th`;
  if (j === 1) return `${n}st`;
  if (j === 2) return `${n}nd`;
  if (j === 3) return `${n}rd`;
  return `${n}th`;
}

function formatIsoDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${ordinalDay(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatDateRange(start, end) {
  const a = formatIsoDate(start);
  const b = formatIsoDate(end);
  if (a && b) return `${a} to ${b}`;
  return a || b || "";
}

function signRequest(path) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac("sha256", KRAFTON_HMAC_KEY).update(`${path}.${ts}`).digest("hex");
  return { "X-Request-Signature": sig, "X-Request-Timestamp": ts };
}

async function kraftonPlayerGet(path) {
  const url = `${KRAFTON_API_BASE}v2/player${path}`;
  const response = await fetch(url, { headers: signRequest(path) });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data || data.code) return null;
  return data;
}

function extractArray(src, name) {
  const token = `${name}=[`;
  const start = src.indexOf(token);
  if (start < 0) return [];

  let i = start + token.length - 1;
  let depth = 0;
  let end = -1;
  for (; i < src.length; i += 1) {
    if (src[i] === "[") depth += 1;
    else if (src[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];

  try {
    // Same embedded arrays the official SPA ships in its bundle.
    // eslint-disable-next-line no-new-func
    return new Function(`return ${src.slice(start + name.length + 1, end + 1)}`)();
  } catch {
    return [];
  }
}

async function resolveBundlePath() {
  const response = await fetch(`${KRAFTON_ORIGIN}/`);
  const html = await response.text();
  const match = html.match(/\/assets\/index-[^"']+\.js/);
  return match ? match[0] : null;
}

async function loadBundleArrays() {
  if (Date.now() - bundleCache.at < CACHE_TTL_MS && bundleCache.x9.length > 0) {
    return bundleCache;
  }

  try {
    const jsPath = (await resolveBundlePath()) || bundleCache.jsPath;
    if (!jsPath) throw new Error("Could not resolve Krafton bundle path.");

    const response = await fetch(`${KRAFTON_ORIGIN}${jsPath}`);
    if (!response.ok) throw new Error(`Bundle HTTP ${response.status}`);

    const src = await response.text();
    bundleCache = {
      at: Date.now(),
      x9: extractArray(src, "X9"),
      h9: extractArray(src, "H9"),
      jsPath,
    };
  } catch (error) {
    console.error("[kraftonFeed] bundle fetch failed:", error.message);
  }

  return bundleCache;
}

function mapStaticPast(item) {
  const banner = item.bannerData || {};
  const overview = item.overview || {};
  const bannerImage = banner.backGroundImageURL || banner.ThumbnailImageURL || "";
  const thumbImage = banner.ThumbnailImageURL || banner.backGroundImageURL || banner.logo || "";

  return {
    id: String(item.id || item.name || banner.title || "").trim() || banner.title,
    title: banner.title || item.name || "Tournament",
    subtitle: banner.description || "",
    dates: overview.datesInCard || "",
    entryType: banner.type || "",
    image: absUrl(bannerImage),
    thumbnail: absUrl(thumbImage),
    logo: absUrl(banner.logo),
    source: "krafton-static",
  };
}

function mapDynamicPast(item) {
  const config = item.config?.pastTournament || {};
  const bannerImage = item.banner || config.thumbnailLogo || "";
  const thumbImage = config.thumbnailLogo || item.banner || item.logo || "";

  return {
    id: item._id,
    title: item.name || "Tournament",
    subtitle: config.description || "",
    dates: formatDateRange(item.tournamentDate?.startDate, item.tournamentDate?.endDate),
    entryType: item.schedule?.tournamentType || "",
    image: absUrl(bannerImage),
    thumbnail: absUrl(thumbImage),
    logo: absUrl(item.logo),
    source: "krafton-api",
  };
}

function mapFeaturedCard(item, datesByTitle) {
  const banner = item.bannerData || {};
  if (!banner.title && !banner.backGroundImageURL) return null;

  const title = banner.title || item.name || "Event";
  const thumbImage = banner.ThumbnailImageURL || banner.backGroundImageURL || banner.logo || "";
  let datesLine = datesByTitle.get(title.toLowerCase()) || "";

  if (!datesLine && item.registrationEndDate) {
    const end = formatIsoDate(item.registrationEndDate);
    datesLine = end ? `Through ${end}` : "";
  }
  if (!datesLine) datesLine = "See KRAFTON ESPORTS for schedule";

  return {
    id: String(item.id || item.name || title).trim() || title,
    title,
    entryType: banner.type || "Open",
    datesLine,
    image: absUrl(thumbImage),
    subtitle: banner.description || "",
    source: "krafton-featured",
  };
}

async function getPastTournaments() {
  const { x9 } = await loadBundleArrays();
  let dynamic = [];

  try {
    const raw = await kraftonPlayerGet("/getVisiblePastTournaments");
    if (Array.isArray(raw)) {
      dynamic = raw.map(mapDynamicPast).filter((row) => row.image || row.thumbnail);
    }
  } catch (error) {
    console.error("[kraftonFeed] past tournaments API failed:", error.message);
  }

  const stat = x9.map(mapStaticPast).filter((row) => row.image || row.thumbnail);
  const merged = [...dynamic];
  const seen = new Set(dynamic.map((row) => row.title.toLowerCase()));

  for (const row of stat) {
    const key = row.title.toLowerCase();
    if (!seen.has(key)) {
      merged.push(row);
      seen.add(key);
    }
  }

  return merged;
}

async function getFeaturedEvents() {
  const { x9, h9 } = await loadBundleArrays();
  const datesByTitle = new Map(
    x9
      .map((item) => {
        const title = item.bannerData?.title || item.name;
        const dates = item.overview?.datesInCard;
        return title && dates ? [title.toLowerCase(), dates] : null;
      })
      .filter(Boolean)
  );

  const cards = h9.map((item) => mapFeaturedCard(item, datesByTitle)).filter(Boolean);
  if (cards.length > 0) return cards;

  return x9.map((item) => {
    const row = mapStaticPast(item);
    return {
      id: row.id,
      title: row.title,
      entryType: row.entryType || "Open",
      datesLine: row.dates || "Dates on KRAFTON ESPORTS",
      image: row.thumbnail || row.image,
      subtitle: row.subtitle,
      source: row.source,
    };
  });
}

module.exports = {
  KRAFTON_ORIGIN,
  getPastTournaments,
  getFeaturedEvents,
};
