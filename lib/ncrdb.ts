// ── USGA National Course Rating Database (NCRDB) client ─────────
// Personal-use scraper for ncrdb.usga.org. There is no public API, so this
// replicates the browser flow: fetch the homepage to mint an antiforgery
// cookie + token, POST a course-name search, then GET the (server-rendered
// HTML) tee-info page for a specific course and parse the tee table with
// regex — no HTML-parsing dependency needed for this fixed table shape.
//
// Recipe verified manually against the live site (see task notes). If USGA
// changes their markup this will need re-verification.

const NCRDB_BASE = "https://ncrdb.usga.org";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 15_000;
const TOKEN_TTL_MS = 10 * 60 * 1000; // ~10 min

export class NcrdbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NcrdbError";
  }
}

export interface NcrdbCourseCandidate {
  courseID: number;
  courseName: string;
  facilityName: string;
  fullName: string;
  address1: string;
  city: string;
  state: string;
  country: string;
  stateDisplay: string;
}

export interface NcrdbTee {
  tee: string;
  gender: "M" | "F";
  par: number;
  rating: number;
  slope: number;
  yards?: number;
}

interface TokenBundle {
  cookie: string;
  token: string;
  fetchedAt: number;
}

let tokenCache: TokenBundle | null = null;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const { signal, cancel } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new NcrdbError(`NCRDB request timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`, err);
    }
    throw new NcrdbError(`NCRDB request failed: ${url}`, err);
  } finally {
    cancel();
  }
}

/** Extract .AspNetCore.Antiforgery.* cookie(s) from a Set-Cookie response. */
function extractAntiforgeryCookies(res: Response): string {
  // Prefer getSetCookie() (Node 18.14+/undici) when available; fall back to
  // the single combined header otherwise.
  const headersWithGetSetCookie = res.headers as Headers & { getSetCookie?: () => string[] };
  const rawCookies: string[] =
    typeof headersWithGetSetCookie.getSetCookie === "function"
      ? headersWithGetSetCookie.getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[^;]+?=)/);

  const antiforgery = rawCookies
    .map((c) => c.split(";")[0]?.trim())
    .filter((c): c is string => !!c && c.startsWith(".AspNetCore.Antiforgery."));

  if (antiforgery.length === 0) {
    throw new NcrdbError("NCRDB homepage did not set an antiforgery cookie");
  }
  return antiforgery.join("; ");
}

/** Fetch the NCRDB homepage once to bootstrap {cookie, token}, with a short in-memory cache. */
async function getToken(): Promise<TokenBundle> {
  if (tokenCache && Date.now() - tokenCache.fetchedAt < TOKEN_TTL_MS) {
    return tokenCache;
  }

  const res = await fetchWithTimeout(`${NCRDB_BASE}/`, {
    method: "GET",
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new NcrdbError(`NCRDB homepage returned ${res.status}`);
  }

  const cookie = extractAntiforgeryCookies(res);
  const html = await res.text();
  const match = html.match(/__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/);
  if (!match) {
    throw new NcrdbError("Could not find __RequestVerificationToken in NCRDB homepage HTML");
  }

  const bundle: TokenBundle = { cookie, token: match[1], fetchedAt: Date.now() };
  tokenCache = bundle;
  return bundle;
}

/** Normalize a state input ("CA" or "US-CA") to the "US-XX" format NCRDB expects. */
function normalizeState(state: string): string {
  const trimmed = state.trim().toUpperCase();
  if (trimmed.startsWith("US-")) return trimmed;
  return `US-${trimmed}`;
}

/**
 * Search NCRDB for courses matching `name` (and optionally `state`, default
 * "US-CA" / "CA"). Returns an empty array when there are no matches (NCRDB
 * itself also won't match on clubName strings under 3 characters).
 */
export async function searchCourses(
  name: string,
  state: string = "US-CA"
): Promise<NcrdbCourseCandidate[]> {
  const q = name.trim();
  if (!q) {
    throw new NcrdbError("searchCourses requires a non-empty course name");
  }

  const { cookie, token } = await getToken();
  const stateCode = normalizeState(state);

  const body = new URLSearchParams({
    clubName: q,
    clubCity: "",
    clubState: stateCode,
    clubCountry: "USA",
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(`${NCRDB_BASE}/NCRListing?handler=LoadCourses`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        RequestVerificationToken: token,
        Cookie: cookie,
      },
      body: body.toString(),
    });
  } catch (err) {
    if (err instanceof NcrdbError) throw err;
    throw new NcrdbError("NCRDB course search request failed", err);
  }

  if (res.status === 400 || res.status === 403) {
    // Antiforgery token likely stale — refresh once and retry.
    tokenCache = null;
    const retry = await getToken();
    res = await fetchWithTimeout(`${NCRDB_BASE}/NCRListing?handler=LoadCourses`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        RequestVerificationToken: retry.token,
        Cookie: retry.cookie,
      },
      body: body.toString(),
    });
  }

  if (!res.ok) {
    throw new NcrdbError(`NCRDB course search returned ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new NcrdbError("NCRDB course search returned non-JSON response", err);
  }

  if (!Array.isArray(json)) {
    throw new NcrdbError("NCRDB course search returned an unexpected shape");
  }

  return json.map((c) => {
    const r = c as Record<string, unknown>;
    return {
      courseID: Number(r.courseID),
      courseName: String(r.courseName ?? ""),
      facilityName: String(r.facilityName ?? ""),
      fullName: String(r.fullName ?? ""),
      address1: String(r.address1 ?? ""),
      city: String(r.city ?? ""),
      state: String(r.state ?? ""),
      country: String(r.country ?? ""),
      stateDisplay: String(r.stateDisplay ?? ""),
    };
  });
}

// Matches a single <td ...>...</td> cell, capturing its inner content.
const TD_RE = /<td[^>]*>([\s\S]*?)<\/td>/g;
// Matches each <tr ...> row-open tag so we can split the tee table into
// per-row chunks (NOT split on the colWidth14 class — that class is reused
// on a later cell within the same row, e.g. the slope cell, so anchoring on
// it directly would slice rows apart mid-row).
const ROW_START_RE = /<tr[^>]*>/g;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

/**
 * Fetch and parse the tee table for a course from its server-rendered HTML
 * page. Returns all tees found (both genders) — callers should filter to
 * "M" by default per the app's single-user (male) use case.
 */
export async function getCourseTees(courseID: number): Promise<NcrdbTee[]> {
  if (!Number.isFinite(courseID) || courseID <= 0) {
    throw new NcrdbError("getCourseTees requires a positive numeric courseID");
  }

  const { cookie } = await getToken();

  const res = await fetchWithTimeout(`${NCRDB_BASE}/courseTeeInfo?CourseID=${courseID}`, {
    method: "GET",
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });
  if (!res.ok) {
    throw new NcrdbError(`NCRDB tee info returned ${res.status} for courseID=${courseID}`);
  }

  const html = await res.text();

  // Narrow to the tee table specifically (id="gvTee") so unrelated <tr>s
  // elsewhere on the page (e.g. the course-search results table) can't leak
  // in as false rows.
  const teeTableStart = html.indexOf('id="gvTee"');
  const teeTableHtml = teeTableStart === -1 ? html : html.slice(teeTableStart);
  const teeTableEnd = teeTableHtml.indexOf("</table>");
  const scoped = teeTableEnd === -1 ? teeTableHtml : teeTableHtml.slice(0, teeTableEnd);

  // Split into row chunks anchored on each <tr> tag.
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  ROW_START_RE.lastIndex = 0;
  while ((m = ROW_START_RE.exec(scoped))) {
    starts.push(m.index);
  }

  const tees: NcrdbTee[] = [];
  for (let i = 0; i < starts.length; i++) {
    const chunkStart = starts[i];
    const chunkEnd = i + 1 < starts.length ? starts[i + 1] : scoped.length;
    const rowHtml = scoped.slice(chunkStart, chunkEnd);

    // Skip the header row (<th> cells) and any row that isn't a tee-data
    // row — real tee rows start with the tee-name cell tagged colWidth14.
    if (!/<td[^>]*class="[^"]*colWidth14[^"]*"/.test(rowHtml)) continue;

    const cells: string[] = [];
    TD_RE.lastIndex = 0;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = TD_RE.exec(rowHtml))) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length < 6) continue;

    const [teeName, genderRaw, parRaw, ratingRaw, , slopeRaw, ...hidden] = cells;
    const gender = genderRaw.trim().toUpperCase();
    if (gender !== "M" && gender !== "F") continue;

    const par = parseInt(parRaw, 10);
    const rating = parseFloat(ratingRaw);
    const slope = parseInt(slopeRaw, 10);
    if (!Number.isFinite(par) || !Number.isFinite(rating) || !Number.isFinite(slope)) continue;

    // Best-effort yardage: look for a plausible 4-digit yardage among the
    // trailing hidden cells; omit if nothing parses cleanly.
    let yards: number | undefined;
    for (const cell of hidden) {
      const n = parseInt(cell.replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n >= 1000 && n <= 8000) {
        yards = n;
        break;
      }
    }

    tees.push({
      tee: teeName || "—",
      gender: gender as "M" | "F",
      par,
      rating,
      slope,
      ...(yards !== undefined ? { yards } : {}),
    });
  }

  return tees;
}

/** Convenience wrapper: tees filtered to gender "M" (the app's default display). */
export function filterMenTees(tees: NcrdbTee[]): NcrdbTee[] {
  return tees.filter((t) => t.gender === "M");
}
