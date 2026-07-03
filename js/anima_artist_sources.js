import "./data.js";

const ARTIST_SOURCE_STORAGE_KEY = "anima-hub-artist-source";
const MOOSHIE_MANIFEST_URL = "/anima-tools/artist/mooshie/manifest";
const MOOSHIE_SEARCH_URL = "/anima-tools/artist/mooshie/search";

export const ARTIST_SOURCES = [
    { id: "theta", label: "Theta" },
    { id: "mooshie", label: "Mooshie" },
    { id: "merged", label: "Merged" },
];

let activeArtistSource = localStorage.getItem(ARTIST_SOURCE_STORAGE_KEY) || "theta";
let mooshieManifestPromise = null;
let mooshieSearchPromise = null;
let artistSourceStatus = {
    theta: "",
    mooshie: "Not loaded",
    merged: "",
};

function normalizeArtistName(value) {
    return String(value || "")
        .replace(/^@/, "")
        .replace(/^by\s+/i, "")
        .trim();
}

function normalizeKey(value) {
    return normalizeArtistName(value)
        .replace(/[_\s]+/g, " ")
        .toLowerCase();
}

function thetaImageUrl(item) {
    if (!item?.id) return "";
    const partition = item.p || item.partition || 1;
    return `https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images/${partition}/${item.id}.webp`;
}

function normalizeThetaArtist(item) {
    const name = normalizeArtistName(item?.name);
    return {
        ...item,
        section: "artist",
        source: "theta",
        sourceLabel: "Theta",
        sourceKey: name,
        hubKey: `theta:${name}`,
        name,
        prompt: `@${name}`,
        post_count: item?.post_count ?? 0,
        postCount: item?.post_count ?? 0,
        imageUrl: item?.imageUrl || thetaImageUrl(item),
        aliases: Array.isArray(item?.aliases) ? item.aliases : [],
    };
}

function setMooshieFailureStatus(error) {
    const message = error?.message || String(error || "unknown error");
    artistSourceStatus.mooshie = `Failed: ${message}`;
}

async function loadMooshieManifest() {
    if (!mooshieManifestPromise) {
        artistSourceStatus.mooshie = "Loading manifest through ComfyUI";
        mooshieManifestPromise = fetch(MOOSHIE_MANIFEST_URL)
            .then(response => {
                if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
                return response.json();
            })
            .catch(error => {
                setMooshieFailureStatus(error);
                mooshieManifestPromise = null;
                throw error;
            });
    }
    return mooshieManifestPromise;
}

function normalizeMooshieArtist(item, manifest) {
    const prompt = String(item?.tag || "").trim();
    const name = normalizeArtistName(prompt || item?.slug);
    const imageUrl = item?.imageUrl || (item?.imageId ? `${manifest.imageBaseUrl}/${manifest.releasePrefix}/images/${item.imageId}.avif` : "");
    return {
        ...item,
        section: "artist",
        source: "mooshie",
        sourceLabel: "Mooshie",
        sourceKey: item?.slug || name,
        hubKey: `mooshie:${item?.slug || name}`,
        name,
        prompt: prompt || `@${name}`,
        post_count: item?.postCount ?? item?.post_count ?? 0,
        postCount: item?.postCount ?? item?.post_count ?? 0,
        imageUrl,
        aliases: Array.isArray(item?.aliases) ? item.aliases : [],
    };
}

async function loadMooshieArtists() {
    if (!mooshieSearchPromise) {
        mooshieSearchPromise = loadMooshieManifest()
            .then(async manifest => {
                artistSourceStatus.mooshie = "Loading search index through ComfyUI";
                const response = await fetch(MOOSHIE_SEARCH_URL);
                if (!response.ok) throw new Error(`search HTTP ${response.status}`);
                const rows = await response.json();
                const artists = Array.isArray(rows) ? rows.map(item => normalizeMooshieArtist(item, manifest)) : [];
                artistSourceStatus.mooshie = `${artists.length.toLocaleString()} artists`;
                return artists;
            })
            .catch(error => {
                console.warn("[Anima Tools] Failed to load Mooshie artists", error);
                setMooshieFailureStatus(error);
                mooshieSearchPromise = null;
                return [];
            });
    }
    return mooshieSearchPromise;
}

function loadThetaArtists() {
    const rows = Array.isArray(window.galleryData) ? window.galleryData : [];
    artistSourceStatus.theta = `${rows.length.toLocaleString()} artists`;
    return rows.map(normalizeThetaArtist);
}

function mergeArtists(thetaArtists, mooshieArtists) {
    const merged = new Map();
    thetaArtists.forEach(item => {
        merged.set(normalizeKey(item.prompt || item.name), {
            ...item,
            source: "merged",
            sourceLabel: "Theta",
            hubKey: `merged:${normalizeKey(item.prompt || item.name)}`,
        });
    });
    mooshieArtists.forEach(item => {
        const key = normalizeKey(item.prompt || item.name);
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, {
                ...item,
                source: "merged",
                sourceLabel: "Mooshie",
                hubKey: `merged:${key}`,
            });
            return;
        }
        merged.set(key, {
            ...existing,
            source: "merged",
            sourceLabel: "Merged",
            post_count: Math.max(existing.post_count || 0, item.post_count || 0),
            postCount: Math.max(existing.postCount || 0, item.postCount || 0),
            imageUrl: item.imageUrl || existing.imageUrl,
            mooshie: item,
            theta: existing,
            aliases: [...new Set([...(existing.aliases || []), ...(item.aliases || [])])],
        });
    });
    const result = Array.from(merged.values()).sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
    artistSourceStatus.merged = artistSourceStatus.mooshie.startsWith("Failed")
        ? `${result.length.toLocaleString()} artists (Theta only; Mooshie failed)`
        : `${result.length.toLocaleString()} artists`;
    return result;
}

export function getActiveArtistSource() {
    return ARTIST_SOURCES.some(source => source.id === activeArtistSource) ? activeArtistSource : "theta";
}

export function setActiveArtistSource(source) {
    activeArtistSource = ARTIST_SOURCES.some(item => item.id === source) ? source : "theta";
    localStorage.setItem(ARTIST_SOURCE_STORAGE_KEY, activeArtistSource);
}

export function getArtistSourceStatus(source = getActiveArtistSource()) {
    return artistSourceStatus[source] || "";
}

export async function getArtistDataForSource(source = getActiveArtistSource()) {
    const thetaArtists = loadThetaArtists();
    if (source === "theta") return thetaArtists;

    const mooshieArtists = await loadMooshieArtists();
    if (source === "mooshie") return mooshieArtists;
    return mergeArtists(thetaArtists, mooshieArtists);
}
