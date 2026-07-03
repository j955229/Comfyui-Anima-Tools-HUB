import { app } from "../../scripts/app.js";
import { applyTagsToTarget } from "./anima_apply_tags.js";
import { ANIMA_SECTION_WIDGETS, getTargetById, resolveAnimaTargets } from "./anima_target_resolver.js";
import { ARTIST_SOURCES, getActiveArtistSource, getArtistDataForSource, getArtistSourceStatus, setActiveArtistSource } from "./anima_artist_sources.js";
import "./character_data.js";
import "./clothing_data.js";
import "./background_data.js";
import "./pose_data.js";

const SECTIONS = [
    { id: "artist", label: "Artist", widget: "artist_tags", accent: "#38bdf8" },
    { id: "character", label: "Character", widget: "character_tags", accent: "#f472b6" },
    { id: "clothing", label: "Clothing", widget: "clothing_tags", accent: "#a78bfa" },
    { id: "background", label: "Background", widget: "background_tags", accent: "#34d399" },
    { id: "pose", label: "Pose", widget: "pose_tags", accent: "#f59e0b" },
];

const FAVORITES_STORAGE_KEY = "anima-hub-favorites-fallback";

const HUB_STATE = {
    activeSection: "artist",
    preferredNode: null,
    viewMode: "all",
    artistSource: getActiveArtistSource(),
    artistData: [],
    artistDataLoadedSource: "",
    artistDataLoading: false,
    artistDataRequestId: 0,
    selected: {
        artist: new Map(),
        character: new Map(),
        clothing: new Map(),
        background: new Map(),
        pose: new Map(),
    },
    targetIds: {},
    favoritesConfig: null,
    favoritesLoaded: false,
};

let activeHub = null;
let characterOfficialDataPromise = null;

function splitPromptTokens(value) {
    return String(value || "")
        .split(",")
        .map(part => part.replace(/^_raw_:/, "").trim())
        .filter(Boolean);
}

function normalizePromptToken(value) {
    return String(value || "").replace(/^_raw_:/, "").trim().toLowerCase();
}

function titleCase(value) {
    return String(value || "")
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function defaultFavoritesConfig() {
    const config = {};
    SECTIONS.forEach(section => {
        config[section.id] = {
            groups: [{ id: "default", name: "My Favorites", isSystem: true }],
            items: [],
        };
    });
    return config;
}

function normalizeFavoritesConfig(data) {
    const config = defaultFavoritesConfig();
    if (!data || typeof data !== "object") {
        return config;
    }
    SECTIONS.forEach(section => {
        const source = data[section.id];
        if (!source || typeof source !== "object") return;
        config[section.id] = {
            groups: Array.isArray(source.groups) && source.groups.length ? source.groups : config[section.id].groups,
            items: Array.isArray(source.items) ? source.items : [],
        };
    });
    return config;
}

async function loadFavoritesConfig() {
    if (HUB_STATE.favoritesLoaded) return HUB_STATE.favoritesConfig;

    let config = null;
    try {
        const response = await fetch("/anima-tools/favorites");
        if (response.ok) {
            config = await response.json();
        }
    } catch (error) {
        console.warn("[Anima Tools] Failed to load Hub favorites from server", error);
    }

    if (!config) {
        try {
            config = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "null");
        } catch (error) {
            console.warn("[Anima Tools] Failed to load Hub favorites fallback", error);
        }
    }

    HUB_STATE.favoritesConfig = normalizeFavoritesConfig(config);
    HUB_STATE.favoritesLoaded = true;
    return HUB_STATE.favoritesConfig;
}

async function saveFavoritesConfig() {
    const config = normalizeFavoritesConfig(HUB_STATE.favoritesConfig);
    HUB_STATE.favoritesConfig = config;
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(config));

    try {
        await fetch("/anima-tools/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        });
    } catch (error) {
        console.warn("[Anima Tools] Failed to save Hub favorites to server", error);
    }
}

async function ensureCharacterOfficialData() {
    if (window.characterOfficialData) return window.characterOfficialData;
    if (!characterOfficialDataPromise) {
        const dataUrl = new URL("./character_official_data.json", import.meta.url);
        characterOfficialDataPromise = fetch(dataUrl)
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (data && typeof data === "object") {
                    window.characterOfficialData = data;
                    return data;
                }
                return null;
            })
            .catch(error => {
                console.warn("[Anima Tools] Failed to load local official character tags", error);
                return null;
            });
    }
    return characterOfficialDataPromise;
}

function getCharacterCacheKey(item) {
    return `${normalizePromptToken(item?.name)}||${normalizePromptToken(item?.copyright)}`;
}

async function getOfficialCharacterData(item) {
    if (!item || item.isCustom) return null;
    const data = await ensureCharacterOfficialData();
    return data?.[getCharacterCacheKey(item)] || item._officialData || null;
}

function pushUniquePromptTokens(target, seen, value) {
    splitPromptTokens(value).forEach(token => {
        const key = normalizePromptToken(token);
        if (key && !seen.has(key)) {
            seen.add(key);
            target.push(token);
        }
    });
}

function getSectionData(section) {
    if (section === "artist") return HUB_STATE.artistDataLoadedSource === HUB_STATE.artistSource ? HUB_STATE.artistData : [];
    if (section === "character") return window.characterData || [];
    if (section === "clothing") return window.clothingData || [];
    if (section === "background") return window.backgroundData || [];
    if (section === "pose") return window.poseData || [];
    return [];
}

function getItemKey(section, item) {
    if (item?.hubKey) return String(item.hubKey);
    if (section === "artist") return `${item?.source || "theta"}:${item?.sourceKey || item?.name || item?.prompt || ""}`;
    return String(item?.id || item?.name || item?.tags || "");
}

function getItemTitle(section, item) {
    if (section === "artist") return item?.prompt || `@${item?.name || ""}`;
    if (section === "character") return titleCase(item?.name || "");
    return item?.name || item?.name_zh || item?.tags || "";
}

function getItemMeta(section, item) {
    if (section === "artist") return [item?.sourceLabel, `${item?.post_count ?? item?.postCount ?? 0} works`].filter(Boolean).join(" / ");
    if (section === "character") return [item?.copyright, item?.post_count ? `${item.post_count} works` : ""].filter(Boolean).join(" / ");
    return [item?.categories?.[0], item?.traits?.slice?.(0, 3)?.join(", ")].filter(Boolean).join(" / ");
}

function getSearchText(section, item) {
    return [
        getItemTitle(section, item),
        getItemMeta(section, item),
        item?.name,
        item?.name_zh,
        item?.copyright,
        item?.tags,
        item?.tags_zh,
        item?.prompt,
        item?.source,
        item?.sourceLabel,
        ...(Array.isArray(item?.aliases) ? item.aliases : []),
    ].join(" ").toLowerCase();
}

function getArtistImageUrl(item) {
    if (!item?.id) return "";
    const partition = item.p || item.partition || 1;
    return `https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images/${partition}/${item.id}.webp`;
}

function getCharacterImageUrl(item) {
    if (!item?.name) return "";
    const rawName = item.copyright ? `${item.name}, ${item.copyright}` : item.name;
    return `https://blobs.animadex.net/Outputs/thumbs/${encodeURIComponent(rawName)}.webp`;
}

function getItemImageUrl(section, item) {
    if (section === "artist") return item?.imageUrl || getArtistImageUrl(item);
    if (section === "character") return item?.imageUrl || item?.preview || getCharacterImageUrl(item);
    return item?.preview || item?.imageUrl || item?.thumbnailUrl || "";
}

function getDanbooruUrl(section, item) {
    if (item?.url) return item.url;
    if (section === "artist" && (item?.prompt || item?.name)) {
        const tag = String(item?.prompt || item?.name || "").replace(/^@/, "");
        return `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(tag)}`;
    }
    if (section === "character" && item?.name) {
        return `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(item.name)}`;
    }
    return "";
}

async function getPromptForItem(section, item, characterMode = item?._hubCharacterMode || "trigger") {
    if (section === "artist") return item?.prompt || `@${item?.name || ""}`;
    if (section === "character") {
        if (item?.isCustom) return item.customContent || item.name || "";
        const officialData = await getOfficialCharacterData(item);
        const trigger = officialData?.trigger || [item?.name, item?.copyright].filter(Boolean).join(", ");
        if (characterMode !== "trigger_tags") return trigger;

        const result = [];
        const seen = new Set();
        pushUniquePromptTokens(result, seen, trigger);
        pushUniquePromptTokens(result, seen, officialData?.tags);
        pushUniquePromptTokens(result, seen, officialData?.core_tags);
        pushUniquePromptTokens(result, seen, officialData?.coreTags);
        if (result.length === 1) {
            pushUniquePromptTokens(result, seen, item?.gender);
            if (item?.hair) pushUniquePromptTokens(result, seen, `${item.hair} hair`);
            if (item?.eye) pushUniquePromptTokens(result, seen, `${item.eye} eyes`);
        }
        return result.join(", ");
    }
    return splitPromptTokens(item?.tags).join(", ");
}

async function formatSelectedPrompt(section) {
    const selected = Array.from(HUB_STATE.selected[section].values());
    const prompts = await Promise.all(selected.map(item => getPromptForItem(section, item)));
    const prompt = prompts.flatMap(splitPromptTokens).filter(Boolean).join(", ");
    return prompt ? `${prompt}, ` : "";
}

function getFavoritesMap(section) {
    const config = normalizeFavoritesConfig(HUB_STATE.favoritesConfig);
    return new Map((config[section]?.items || []).map(item => [getItemKey(section, item), item]));
}

function toFavoriteItem(section, item) {
    const key = getItemKey(section, item);
    return {
        ...item,
        hubKey: key,
        section,
        groupIds: Array.isArray(item?.groupIds) && item.groupIds.length ? item.groupIds : ["default"],
    };
}

async function toggleFavorite(section, item) {
    const config = await loadFavoritesConfig();
    const sectionConfig = config[section];
    const key = getItemKey(section, item);
    const nextItems = [];
    let removed = false;

    for (const favorite of sectionConfig.items || []) {
        if (getItemKey(section, favorite) === key) {
            removed = true;
            continue;
        }
        nextItems.push(favorite);
    }

    if (!removed) {
        nextItems.push(toFavoriteItem(section, item));
    }

    sectionConfig.items = nextItems;
    HUB_STATE.favoritesConfig = config;
    await saveFavoritesConfig();
}

function getVisibleData(section) {
    if (HUB_STATE.viewMode === "favorites") {
        return Array.from(getFavoritesMap(section).values());
    }
    return getSectionData(section);
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
}

async function copyText(text) {
    const value = String(text || "");
    if (!value) return;
    try {
        await navigator.clipboard.writeText(value);
    } catch {
        fallbackCopy(value);
    }
    showToast("Copied");
}

function showToast(message) {
    const existing = document.getElementById("anima-hub-toast");
    if (existing) existing.remove();

    const toast = createEl("div", "anima-hub-toast", message);
    toast.id = "anima-hub-toast";
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("visible"), 10);
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 180);
    }, 1300);
}

function openImagePreview(imageUrl, title = "") {
    if (!imageUrl) return;

    const overlay = createEl("div", "anima-hub-preview-overlay");
    const panel = createEl("div", "anima-hub-preview-panel");
    const close = createEl("button", "anima-hub-preview-close", "Close");
    close.type = "button";
    close.onclick = () => overlay.remove();

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = title;

    panel.appendChild(close);
    panel.appendChild(img);
    overlay.appendChild(panel);
    overlay.addEventListener("mousedown", event => {
        if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

async function getDisplayTags(section, item) {
    if (section === "artist") return splitPromptTokens(item?.name);
    if (section === "character") {
        const officialData = await getOfficialCharacterData(item);
        const tags = [];
        const seen = new Set();
        pushUniquePromptTokens(tags, seen, officialData?.tags);
        pushUniquePromptTokens(tags, seen, officialData?.core_tags);
        pushUniquePromptTokens(tags, seen, officialData?.coreTags);
        if (!tags.length) {
            pushUniquePromptTokens(tags, seen, item?.gender);
            if (item?.hair) pushUniquePromptTokens(tags, seen, `${item.hair} hair`);
            if (item?.eye) pushUniquePromptTokens(tags, seen, `${item.eye} eyes`);
        }
        return tags;
    }
    return splitPromptTokens(item?.tags);
}

function getSelectedItem(section, item, characterMode = "trigger") {
    if (section !== "character") return item;
    return {
        ...item,
        _hubCharacterMode: characterMode,
    };
}

async function refreshArtistData(root) {
    const source = HUB_STATE.artistSource;
    const requestId = ++HUB_STATE.artistDataRequestId;
    HUB_STATE.artistDataLoading = true;

    const data = await getArtistDataForSource(source);
    if (requestId !== HUB_STATE.artistDataRequestId || source !== HUB_STATE.artistSource) {
        return;
    }

    HUB_STATE.artistData = data;
    HUB_STATE.artistDataLoadedSource = source;
    HUB_STATE.artistDataLoading = false;
    if (root && activeHub?.contains(root)) {
        renderHub(root);
    }
}

function ensureArtistData(root) {
    if (HUB_STATE.activeSection !== "artist") return;
    if (HUB_STATE.artistDataLoadedSource === HUB_STATE.artistSource) return;
    if (HUB_STATE.artistDataLoading) return;
    refreshArtistData(root);
}

function installHubStyles() {
    if (document.getElementById("anima-hub-styles")) return;
    const style = document.createElement("style");
    style.id = "anima-hub-styles";
    style.textContent = `
        .anima-hub-overlay {
            position: fixed;
            inset: 0;
            z-index: 100000;
            background: rgba(0, 0, 0, 0.66);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 28px;
            box-sizing: border-box;
        }
        .anima-hub {
            width: min(1180px, 96vw);
            height: min(850px, 92vh);
            background: #15171b;
            color: #f4f4f5;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.58);
            display: grid;
            grid-template-rows: auto auto auto 1fr auto;
            overflow: hidden;
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .anima-hub-header,
        .anima-hub-toolbar,
        .anima-hub-footer {
            padding: 14px 18px;
            border-bottom: 1px solid rgba(255,255,255,0.09);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .anima-hub-footer {
            border-top: 1px solid rgba(255,255,255,0.09);
            border-bottom: 0;
            justify-content: space-between;
        }
        .anima-hub-title {
            font-size: 17px;
            font-weight: 800;
            flex: 1;
        }
        .anima-hub-close,
        .anima-hub-button,
        .anima-hub-tab,
        .anima-hub-pill,
        .anima-hub-card-action {
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            color: #e5e7eb;
            border-radius: 7px;
            height: 34px;
            padding: 0 12px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
        }
        .anima-hub-button.primary,
        .anima-hub-card-action.primary {
            background: #0ea5e9;
            border-color: #38bdf8;
            color: #ffffff;
        }
        .anima-hub-tabs {
            display: flex;
            gap: 8px;
            padding: 0 18px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.09);
            overflow-x: auto;
        }
        .anima-hub-tab.active,
        .anima-hub-pill.active {
            background: rgba(56,189,248,0.16);
            border-color: rgba(56,189,248,0.48);
            color: #ffffff;
        }
        .anima-hub-search,
        .anima-hub-target,
        .anima-hub-artist-source {
            height: 36px;
            border-radius: 7px;
            border: 1px solid rgba(255,255,255,0.12);
            background: #202329;
            color: #f4f4f5;
            padding: 0 11px;
            box-sizing: border-box;
            outline: none;
        }
        .anima-hub-search {
            flex: 1;
            min-width: 180px;
        }
        .anima-hub-target {
            width: min(410px, 38vw);
        }
        .anima-hub-artist-source {
            width: 132px;
        }
        .anima-hub-source-status {
            font-size: 12px;
            color: #a1a1aa;
            white-space: nowrap;
        }
        .anima-hub-view {
            display: flex;
            gap: 8px;
        }
        .anima-hub-grid {
            padding: 16px 18px;
            overflow: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
            align-content: start;
        }
        .anima-hub-card {
            position: relative;
            min-height: 400px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.09);
            background: rgba(255,255,255,0.045);
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 9px;
            box-sizing: border-box;
        }
        .anima-hub-card.selected {
            border-color: rgba(56,189,248,0.64);
            background: rgba(56,189,248,0.13);
        }
        .anima-hub-thumb {
            position: relative;
            width: 100%;
            aspect-ratio: 3 / 4;
            border-radius: 7px;
            overflow: hidden;
            background: #202329;
            border: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #71717a;
            font-size: 12px;
        }
        .anima-hub-thumb img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            background: #202329;
        }
        .anima-hub-overlay-panel {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.16s ease;
            background: linear-gradient(to top, rgba(7,7,12,0.9) 28%, rgba(7,7,12,0.62) 68%, rgba(7,7,12,0.2));
        }
        .anima-hub-thumb:hover .anima-hub-overlay-panel,
        .anima-hub-overlay-panel:focus-within {
            opacity: 1;
            pointer-events: auto;
        }
        .anima-hub-overlay-scroll {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding: 14px 13px 6px;
        }
        .anima-hub-overlay-label {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: #ffffff;
            margin-bottom: 5px;
        }
        .anima-hub-overlay-trigger {
            font-size: 12px;
            font-weight: 700;
            line-height: 1.35;
            color: #f4f4f5;
            background: rgba(0,0,0,0.48);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 8px;
            padding: 6px 8px;
            margin-bottom: 10px;
            user-select: all;
            overflow-wrap: anywhere;
        }
        .anima-hub-tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .anima-hub-tag-chip {
            font-size: 10px;
            color: #f4f4f5;
            background: rgba(255,255,255,0.09);
            border: 1px solid rgba(255,255,255,0.16);
            border-radius: 6px;
            padding: 2px 6px;
            line-height: 1.35;
            max-width: 100%;
            overflow-wrap: anywhere;
        }
        .anima-hub-overlay-actions {
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px;
        }
        .anima-hub-overlay-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
        }
        .anima-hub-overlay-action {
            min-height: 36px;
            height: auto;
            padding: 7px 8px;
            border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.18);
            background: rgba(255,255,255,0.08);
            color: #f4f4f5;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            line-height: 1.2;
            white-space: normal;
            overflow-wrap: anywhere;
        }
        .anima-hub-overlay-action:hover,
        .anima-hub-overlay-action.primary {
            background: #0ea5e9;
            border-color: #38bdf8;
            color: #ffffff;
        }
        .anima-hub-overlay-action:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background: rgba(255,255,255,0.05);
            border-color: rgba(255,255,255,0.12);
            color: #a1a1aa;
        }
        .anima-hub-card-title {
            font-size: 15px;
            font-weight: 800;
            line-height: 1.35;
            overflow-wrap: anywhere;
            min-height: 20px;
        }
        .anima-hub-card-meta,
        .anima-hub-count {
            font-size: 12px;
            line-height: 1.35;
            color: #a1a1aa;
            overflow-wrap: anywhere;
        }
        .anima-hub-card-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
            margin-top: auto;
        }
        .anima-hub-card-action {
            min-height: 32px;
            height: auto;
            padding: 7px 8px;
            font-size: 12px;
            line-height: 1.2;
            white-space: normal;
            overflow-wrap: anywhere;
        }
        .anima-hub-empty {
            grid-column: 1 / -1;
            color: #a1a1aa;
            padding: 24px 0;
        }
        .anima-hub-toast {
            position: fixed;
            left: 50%;
            bottom: 28px;
            z-index: 100002;
            transform: translate(-50%, 12px);
            opacity: 0;
            background: #0ea5e9;
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 999px;
            padding: 9px 16px;
            font-size: 13px;
            font-weight: 800;
            box-shadow: 0 14px 36px rgba(0,0,0,0.4);
            transition: opacity 0.18s ease, transform 0.18s ease;
        }
        .anima-hub-toast.visible {
            opacity: 1;
            transform: translate(-50%, 0);
        }
        .anima-hub-preview-overlay {
            position: fixed;
            inset: 0;
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px;
            background: rgba(0,0,0,0.58);
        }
        .anima-hub-preview-panel {
            position: relative;
            width: min(540px, 72vw);
            max-height: 86vh;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.14);
            background: #15171b;
            padding: 12px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.58);
        }
        .anima-hub-preview-panel img {
            width: 100%;
            max-height: calc(86vh - 24px);
            object-fit: contain;
            display: block;
            border-radius: 7px;
            background: #202329;
        }
        .anima-hub-preview-close {
            position: absolute;
            right: 10px;
            top: 10px;
            z-index: 1;
            height: 30px;
            padding: 0 10px;
            border-radius: 7px;
            border: 1px solid rgba(255,255,255,0.16);
            background: rgba(0,0,0,0.58);
            color: #ffffff;
            cursor: pointer;
            font-size: 12px;
            font-weight: 800;
        }
        @media (max-width: 760px) {
            .anima-hub-toolbar,
            .anima-hub-footer {
                flex-wrap: wrap;
            }
            .anima-hub-target,
            .anima-hub-artist-source {
                width: 100%;
            }
            .anima-hub-source-status {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

function renderViewButtons(root) {
    root.querySelectorAll(".anima-hub-pill").forEach(button => {
        button.classList.toggle("active", button.dataset.view === HUB_STATE.viewMode);
    });
}

function createOverlayButton(label, onClick, primary = false) {
    const button = createEl("button", primary ? "anima-hub-overlay-action primary" : "anima-hub-overlay-action", label);
    button.type = "button";
    button.onclick = onClick;
    return button;
}

function fillOverlayTags(tagContainer, tags) {
    tagContainer.innerHTML = "";
    const limited = tags.slice(0, 18);
    if (!limited.length) {
        tagContainer.appendChild(createEl("span", "anima-hub-tag-chip", "No tags"));
        return;
    }
    limited.forEach(tag => {
        tagContainer.appendChild(createEl("span", "anima-hub-tag-chip", tag));
    });
}

function createCardOverlay(root, section, item, imageUrl) {
    const key = getItemKey(section, item);
    const selected = HUB_STATE.selected[section].get(key);
    const selectedMode = selected?._hubCharacterMode || "";
    const danbooruUrl = getDanbooruUrl(section, item);

    const overlay = createEl("div", "anima-hub-overlay-panel");
    const scroll = createEl("div", "anima-hub-overlay-scroll");
    scroll.appendChild(createEl("div", "anima-hub-overlay-label", "Trigger"));
    const trigger = createEl("div", "anima-hub-overlay-trigger", section === "artist" ? `@${item?.name || ""}` : getItemTitle(section, item));
    getPromptForItem(section, item, "trigger").then(prompt => {
        if (prompt) trigger.textContent = prompt;
    });
    scroll.appendChild(trigger);
    scroll.appendChild(createEl("div", "anima-hub-overlay-label", "Tags"));
    const tagList = createEl("div", "anima-hub-tag-list");
    fillOverlayTags(tagList, splitPromptTokens(item?.tags || item?.name || ""));
    getDisplayTags(section, item).then(tags => fillOverlayTags(tagList, tags));
    scroll.appendChild(tagList);

    const actions = createEl("div", "anima-hub-overlay-actions");
    const topRow = createEl("div", "anima-hub-overlay-row");
    const fullImageButton = createOverlayButton("Full Image", () => openImagePreview(imageUrl, getItemTitle(section, item)));
    fullImageButton.disabled = !imageUrl;
    topRow.appendChild(fullImageButton);
    const sourceButton = createOverlayButton("Danbooru", () => {
        if (danbooruUrl) window.open(danbooruUrl, "_blank", "noopener,noreferrer");
    });
    sourceButton.disabled = !danbooruUrl;
    topRow.appendChild(sourceButton);
    actions.appendChild(topRow);

    if (section === "character") {
        const selectRow = createEl("div", "anima-hub-overlay-row");
        selectRow.appendChild(createOverlayButton("Trigger", () => {
            HUB_STATE.selected[section].set(key, getSelectedItem(section, item, "trigger"));
            renderHub(root);
        }, selectedMode === "trigger"));
        selectRow.appendChild(createOverlayButton("Trigger + tags", () => {
            HUB_STATE.selected[section].set(key, getSelectedItem(section, item, "trigger_tags"));
            renderHub(root);
        }, selectedMode === "trigger_tags"));
        actions.appendChild(selectRow);

        const copyRow = createEl("div", "anima-hub-overlay-row");
        copyRow.appendChild(createOverlayButton("Copy trigger", async () => {
            const prompt = await getPromptForItem(section, item, "trigger");
            await copyText(prompt ? `${prompt}, ` : "");
        }));
        copyRow.appendChild(createOverlayButton("Copy + tags", async () => {
            const prompt = await getPromptForItem(section, item, "trigger_tags");
            await copyText(prompt ? `${prompt}, ` : "");
        }));
        actions.appendChild(copyRow);
    } else {
        const actionRow = createEl("div", "anima-hub-overlay-row");
        actionRow.appendChild(createOverlayButton(HUB_STATE.selected[section].has(key) ? "Selected" : "Select", () => {
            if (HUB_STATE.selected[section].has(key)) {
                HUB_STATE.selected[section].delete(key);
            } else {
                HUB_STATE.selected[section].set(key, getSelectedItem(section, item));
            }
            renderHub(root);
        }, HUB_STATE.selected[section].has(key)));
        actionRow.appendChild(createOverlayButton("Copy", async () => {
            const prompt = await getPromptForItem(section, item);
            await copyText(prompt ? `${prompt}, ` : "");
        }));
        actions.appendChild(actionRow);
    }

    overlay.appendChild(scroll);
    overlay.appendChild(actions);
    return overlay;
}

function renderHub(root) {
    const section = HUB_STATE.activeSection;
    const sectionDef = SECTIONS.find(item => item.id === section) || SECTIONS[0];
    const query = root.querySelector(".anima-hub-search")?.value?.trim?.().toLowerCase() || "";
    const targets = resolveAnimaTargets(section, HUB_STATE.preferredNode);
    const targetSelect = root.querySelector(".anima-hub-target");
    const sourceSelect = root.querySelector(".anima-hub-artist-source");
    const sourceStatus = root.querySelector(".anima-hub-source-status");

    ensureArtistData(root);

    if (targetSelect) {
        const currentId = HUB_STATE.targetIds[section];
        targetSelect.innerHTML = "";
        if (!targets.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = `No ${ANIMA_SECTION_WIDGETS[section]} target`;
            targetSelect.appendChild(option);
        } else {
            targets.forEach(target => {
                const option = document.createElement("option");
                option.value = target.id;
                option.textContent = target.label;
                targetSelect.appendChild(option);
            });
            targetSelect.value = targets.some(target => target.id === currentId) ? currentId : targets[0].id;
            HUB_STATE.targetIds[section] = targetSelect.value;
        }
    }

    root.querySelectorAll(".anima-hub-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.section === section);
    });
    renderViewButtons(root);

    if (sourceSelect) {
        sourceSelect.style.display = section === "artist" ? "" : "none";
        sourceSelect.value = HUB_STATE.artistSource;
    }
    if (sourceStatus) {
        sourceStatus.style.display = section === "artist" ? "" : "none";
        sourceStatus.textContent = HUB_STATE.artistDataLoading ? "Loading artists..." : getArtistSourceStatus(HUB_STATE.artistSource);
    }

    const allData = getVisibleData(section);
    const selectedMap = HUB_STATE.selected[section];
    const favoriteMap = getFavoritesMap(section);
    const filtered = allData.filter(item => !query || getSearchText(section, item).includes(query)).slice(0, 240);

    const grid = root.querySelector(".anima-hub-grid");
    grid.innerHTML = "";
    if (!allData.length) {
        const sourceStatusText = section === "artist" ? getArtistSourceStatus(HUB_STATE.artistSource) : "";
        let message = HUB_STATE.viewMode === "favorites" ? "No favorites yet." : `${sectionDef.label} data is loading.`;
        if (section === "artist" && HUB_STATE.artistDataLoading) {
            message = sourceStatusText || "Artist data is loading.";
        } else if (section === "artist" && sourceStatusText.startsWith("Failed")) {
            message = `Artist source load failed. ${sourceStatusText}`;
        } else if (section === "artist" && sourceStatusText) {
            message = sourceStatusText;
        }
        grid.appendChild(createEl("div", "anima-hub-empty", message));
    } else if (!filtered.length) {
        grid.appendChild(createEl("div", "anima-hub-empty", "No matching items."));
    } else {
        filtered.forEach(item => {
            const key = getItemKey(section, item);
            const card = createEl("div", "anima-hub-card");
            card.classList.toggle("selected", selectedMap.has(key));

            const thumb = createEl("div", "anima-hub-thumb", "No image");
            const imageUrl = getItemImageUrl(section, item);
            if (imageUrl) {
                thumb.textContent = "";
                const img = document.createElement("img");
                img.loading = "lazy";
                img.src = imageUrl;
                img.alt = getItemTitle(section, item);
                img.onclick = () => openImagePreview(imageUrl, getItemTitle(section, item));
                img.onerror = () => {
                    img.remove();
                    thumb.textContent = "No image";
                };
                thumb.appendChild(img);
            }
            thumb.appendChild(createCardOverlay(root, section, item, imageUrl));

            const title = createEl("div", "anima-hub-card-title", getItemTitle(section, item));
            const meta = createEl("div", "anima-hub-card-meta", getItemMeta(section, item) || item?.tags || "");

            const actions = createEl("div", "anima-hub-card-actions");
            const favorite = createEl("button", favoriteMap.has(key) ? "anima-hub-card-action primary" : "anima-hub-card-action", favoriteMap.has(key) ? "Saved" : "Favorite");
            favorite.type = "button";
            favorite.title = favoriteMap.has(key) ? "Remove favorite" : "Add favorite";
            favorite.onclick = async () => {
                favorite.disabled = true;
                await toggleFavorite(section, item);
                renderHub(root);
            };

            actions.appendChild(favorite);
            card.appendChild(thumb);
            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(actions);
            grid.appendChild(card);
        });
    }

    const count = root.querySelector(".anima-hub-count");
    if (count) {
        const sourceLabel = HUB_STATE.viewMode === "favorites" ? "favorites" : "total";
        count.textContent = `${selectedMap.size} selected / ${allData.length} ${sourceLabel} / showing ${filtered.length}`;
    }
}

function switchSection(root, section) {
    HUB_STATE.activeSection = section;
    const search = root.querySelector(".anima-hub-search");
    if (search) search.value = "";
    renderHub(root);
}

function closeHub() {
    activeHub?.remove();
    activeHub = null;
}

async function applyCurrentSelection(root) {
    const activeSection = HUB_STATE.activeSection;
    if (HUB_STATE.selected[activeSection].size === 0) {
        closeHub();
        return;
    }

    const prompt = await formatSelectedPrompt(activeSection);
    const targetInfo = getTargetById(activeSection, HUB_STATE.targetIds[activeSection], HUB_STATE.preferredNode);
    if (!targetInfo) {
        alert(`No ${ANIMA_SECTION_WIDGETS[activeSection]} target found.`);
        return;
    }
    if (!applyTagsToTarget(targetInfo, prompt)) {
        alert("Failed to apply tags.");
        return;
    }
    closeHub();
}

function createHub(section, preferredNode) {
    installHubStyles();
    closeHub();

    HUB_STATE.activeSection = SECTIONS.some(item => item.id === section) ? section : "artist";
    HUB_STATE.preferredNode = preferredNode || null;

    const overlay = createEl("div", "anima-hub-overlay");
    const root = createEl("div", "anima-hub");
    overlay.appendChild(root);

    const header = createEl("div", "anima-hub-header");
    header.appendChild(createEl("div", "anima-hub-title", "Anima Tools Hub"));
    const close = createEl("button", "anima-hub-close", "Close");
    close.type = "button";
    close.onclick = closeHub;
    header.appendChild(close);

    const tabs = createEl("div", "anima-hub-tabs");
    SECTIONS.forEach(item => {
        const tab = createEl("button", "anima-hub-tab", item.label);
        tab.type = "button";
        tab.dataset.section = item.id;
        tab.onclick = () => switchSection(root, item.id);
        tabs.appendChild(tab);
    });

    const toolbar = createEl("div", "anima-hub-toolbar");
    const search = createEl("input", "anima-hub-search");
    search.type = "search";
    search.placeholder = "Search";
    search.oninput = () => renderHub(root);

    const sourceSelect = createEl("select", "anima-hub-artist-source");
    ARTIST_SOURCES.forEach(source => {
        const option = document.createElement("option");
        option.value = source.id;
        option.textContent = source.label;
        sourceSelect.appendChild(option);
    });
    sourceSelect.value = HUB_STATE.artistSource;
    sourceSelect.onchange = () => {
        HUB_STATE.artistSource = sourceSelect.value;
        setActiveArtistSource(HUB_STATE.artistSource);
        HUB_STATE.artistDataLoadedSource = "";
        HUB_STATE.artistData = [];
        renderHub(root);
    };

    const sourceStatus = createEl("div", "anima-hub-source-status", "");

    const view = createEl("div", "anima-hub-view");
    const allView = createEl("button", "anima-hub-pill", "All");
    allView.type = "button";
    allView.dataset.view = "all";
    allView.onclick = () => {
        HUB_STATE.viewMode = "all";
        renderHub(root);
    };
    const favoritesView = createEl("button", "anima-hub-pill", "Favorites");
    favoritesView.type = "button";
    favoritesView.dataset.view = "favorites";
    favoritesView.onclick = () => {
        HUB_STATE.viewMode = "favorites";
        renderHub(root);
    };
    view.appendChild(allView);
    view.appendChild(favoritesView);

    const target = createEl("select", "anima-hub-target");
    target.onchange = () => {
        HUB_STATE.targetIds[HUB_STATE.activeSection] = target.value;
    };
    toolbar.appendChild(view);
    toolbar.appendChild(sourceSelect);
    toolbar.appendChild(sourceStatus);
    toolbar.appendChild(search);
    toolbar.appendChild(target);

    const grid = createEl("div", "anima-hub-grid");

    const footer = createEl("div", "anima-hub-footer");
    const count = createEl("div", "anima-hub-count", "");
    const buttonRow = createEl("div", "");
    buttonRow.style.cssText = "display: flex; gap: 10px;";
    const clear = createEl("button", "anima-hub-button", "Clear");
    clear.type = "button";
    clear.onclick = () => {
        HUB_STATE.selected[HUB_STATE.activeSection].clear();
        renderHub(root);
    };
    const copySelected = createEl("button", "anima-hub-button", "Copy Selected");
    copySelected.type = "button";
    copySelected.onclick = async () => {
        const prompt = await formatSelectedPrompt(HUB_STATE.activeSection);
        await copyText(prompt);
    };
    const apply = createEl("button", "anima-hub-button primary", "Apply to Target");
    apply.type = "button";
    apply.onclick = async () => applyCurrentSelection(root);
    buttonRow.appendChild(clear);
    buttonRow.appendChild(copySelected);
    buttonRow.appendChild(apply);
    footer.appendChild(count);
    footer.appendChild(buttonRow);

    root.appendChild(header);
    root.appendChild(tabs);
    root.appendChild(toolbar);
    root.appendChild(grid);
    root.appendChild(footer);

    overlay.addEventListener("mousedown", event => {
        if (event.target === overlay) closeHub();
    });
    window.addEventListener("keydown", function onKey(event) {
        if (event.key === "Escape" && activeHub === overlay) {
            window.removeEventListener("keydown", onKey);
            closeHub();
        }
    });

    document.body.appendChild(overlay);
    activeHub = overlay;
    search.focus();
    loadFavoritesConfig().then(() => renderHub(root));
    renderHub(root);
}

export function openAnimaHub(section = "artist", preferredNode = null) {
    createHub(section, preferredNode);
}

function installGlobalButton(useFallback = false) {
    if (document.getElementById("anima-tools-hub-global-button")) return;
    const menu = document.querySelector(".comfy-menu, .comfyui-menu, #comfy-menu, nav");
    const host = menu || (useFallback ? document.body : null);
    if (!host) return;

    const button = document.createElement("button");
    button.id = "anima-tools-hub-global-button";
    button.type = "button";
    button.textContent = "Anima Tools";
    button.title = "Open Anima Tools Hub";
    button.style.cssText = `
        margin: 4px;
        height: 32px;
        padding: 0 12px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(14,165,233,0.18);
        color: #e0f2fe;
        cursor: pointer;
        font-size: 13px;
        font-weight: 800;
    `;
    if (!menu) {
        button.style.position = "fixed";
        button.style.top = "8px";
        button.style.right = "8px";
        button.style.zIndex = "9999";
    }
    button.onclick = () => openAnimaHub("artist", app?.canvas?.current_node || null);
    host.appendChild(button);
}

app.registerExtension({
    name: "AnimaTools.Hub",
    init() {
        setTimeout(installGlobalButton, 300);
        setTimeout(installGlobalButton, 1200);
        setTimeout(() => installGlobalButton(true), 2500);
    },
    setup() {
        installGlobalButton();
    },
});

window.openAnimaHub = openAnimaHub;
