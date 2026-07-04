const ANIMADEX_PAGE_URL = "/anima-tools/character/animadex/pages";
const ANIMADEX_PAGE_BATCH = 8;

export const CHARACTER_SOURCES = [
    { id: "animadex", label: "Animadex" },
];

let characterSourceStatus = {
    animadex: "未载入",
};
const queryStates = new Map();

function normalizeQuery(query = "") {
    return String(query || "").trim();
}

function getQueryKey(query = "") {
    return normalizeQuery(query) || "__popular__";
}

function createQueryState(query = "") {
    return {
        query: normalizeQuery(query),
        rows: [],
        rowKeys: new Set(),
        total: 0,
        pageSize: 0,
        nextPage: 1,
        totalPages: 0,
        loading: false,
        promise: null,
        failed: false,
    };
}

function getQueryState(query = "") {
    const key = getQueryKey(query);
    if (!queryStates.has(key)) {
        queryStates.set(key, createQueryState(query));
    }
    return queryStates.get(key);
}

function normalizeAnimadexCharacter(item) {
    const trigger = String(item?.trigger || "").trim();
    const name = String(item?.name || item?.slug || trigger.split(",")[0] || "").trim();
    return {
        ...item,
        section: "character",
        source: "animadex",
        sourceLabel: "Animadex",
        hubKey: `animadex:${item?.slug || trigger || name}`,
        name,
        copyright: String(item?.copyright || "").trim(),
        copyright_name: item?.copyright_name || "",
        trigger,
        post_count: item?.count ?? item?.post_count ?? 0,
        postCount: item?.count ?? item?.post_count ?? 0,
        imageUrl: item?.thumb_url || item?.img_url || "",
        preview: item?.thumb_url || "",
        tags: Array.isArray(item?.tags) ? item.tags.join(", ") : item?.tags || "",
    };
}

function getCharacterKey(item) {
    return String(item?.hubKey || item?.slug || item?.trigger || item?.name || "").trim();
}

function setAnimadexFailureStatus(error) {
    const message = error?.message || String(error || "unknown error");
    characterSourceStatus.animadex = `载入失败：${message}`;
}

function buildPageUrl(state) {
    const params = new URLSearchParams({
        start: String(state.nextPage || 1),
        pages: String(ANIMADEX_PAGE_BATCH),
    });
    if (state.query) params.set("q", state.query);
    return `${ANIMADEX_PAGE_URL}?${params.toString()}`;
}

async function fetchNextAnimadexBatch(state) {
    if (state.loading) return state.promise || state.rows;
    if (state.nextPage === null) return state.rows;

    const action = state.query ? "搜索" : "载入";
    characterSourceStatus.animadex = `正在${action} Animadex ${state.nextPage ? `第 ${state.nextPage} 页起` : ""}`;
    state.loading = true;
    state.failed = false;
    state.promise = fetch(buildPageUrl(state))
        .then(async response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            if (!payload?.success || !Array.isArray(payload?.results)) {
                throw new Error(payload?.error || "bad payload");
            }

            state.total = Number(payload.total || state.total || payload.results.length || 0);
            state.pageSize = Number(payload.page_size || state.pageSize || 0);
            state.totalPages = Number(payload.total_pages || state.totalPages || 0);
            state.nextPage = payload.next_page === null || payload.next_page === undefined ? null : Number(payload.next_page);

            payload.results.map(normalizeAnimadexCharacter).forEach(row => {
                const key = getCharacterKey(row);
                if (key && state.rowKeys.has(key)) return;
                if (key) state.rowKeys.add(key);
                state.rows.push(row);
            });

            const loaded = state.rows.length.toLocaleString();
            const total = Number(state.total || state.rows.length).toLocaleString();
            const suffix = state.nextPage ? "，滚动继续载入" : "，已完整载入";
            characterSourceStatus.animadex = `${loaded} / ${total} 人物${suffix}`;
            return state.rows;
        })
        .catch(error => {
            console.warn("[Anima Tools] Failed to load Animadex characters", error);
            state.failed = true;
            setAnimadexFailureStatus(error);
            return state.rows;
        })
        .finally(() => {
            state.loading = false;
            state.promise = null;
        });
    return state.promise;
}

export function getActiveCharacterSource() {
    return "animadex";
}

export function setActiveCharacterSource() {
}

export function getCharacterSourceStatus() {
    return characterSourceStatus.animadex || "";
}

export function hasMoreCharacterDataForSource(source = "animadex", query = "") {
    const state = getQueryState(query);
    return source === "animadex" && state.nextPage !== null && !state.loading && !state.failed;
}

export async function loadMoreCharacterDataForSource(source = "animadex", query = "") {
    if (source !== "animadex") return [];
    const state = getQueryState(query);
    return fetchNextAnimadexBatch(state);
}

export async function getCharacterDataForSource(source = "animadex", query = "") {
    if (source !== "animadex") return [];
    const state = getQueryState(query);
    if (!state.rows.length && !state.loading) {
        await fetchNextAnimadexBatch(state);
    }
    return state.rows;
}
