import { app } from "../../scripts/app.js";
import { applyTagsToTarget } from "./anima_apply_tags.js";
import { ANIMA_SECTION_WIDGETS, getTargetById, resolveAnimaTargets } from "./anima_target_resolver.js";
import { ARTIST_SOURCES, getActiveArtistSource, getArtistDataForSource, getArtistSourceStatus, setActiveArtistSource } from "./anima_artist_sources.js";
import { CHARACTER_SOURCES, getActiveCharacterSource, getCharacterDataForSource, getCharacterSourceStatus, hasMoreCharacterDataForSource, loadMoreCharacterDataForSource, setActiveCharacterSource } from "./anima_character_sources.js";
import { getTaxonomyCategories, getTaxonomyGroups, itemMatchesTaxonomy } from "./anima_taxonomy.js";
import "./character_data.js";
import "./clothing_data.js";
import "./background_data.js";
import "./pose_data.js";
import "./composition_data.js";
import "./expression_data.js";
import "./lighting_data.js";

const SECTIONS = [
    { id: "artist", label: "画师", widget: "artist_tags", accent: "#38bdf8" },
    { id: "character", label: "人物", widget: "character_tags", accent: "#f472b6" },
    { id: "clothing", label: "服装", widget: "clothing_tags", accent: "#a78bfa" },
    { id: "background", label: "背景", widget: "background_tags", accent: "#34d399" },
    { id: "pose", label: "姿势", widget: "pose_tags", accent: "#f59e0b" },
    { id: "composition", label: "构图", widget: "composition_tags", accent: "#22d3ee" },
    { id: "expression", label: "表情", widget: "expression_tags", accent: "#fb7185" },
    { id: "lighting", label: "光线", widget: "lighting_tags", accent: "#facc15" },
];

const PAGE_SIZE = 240;
const FAVORITES_STORAGE_KEY = "anima-hub-favorites-fallback";
const EDITS_STORAGE_KEY = "anima-hub-card-edits";
const CUSTOM_HUB_STORAGE_KEY = "anima-hub-custom-data-fallback";

const HUB_STATE = {
    activeSection: "artist",
    preferredNode: null,
    viewMode: "all",
    artistSource: getActiveArtistSource(),
    artistData: [],
    artistDataLoadedSource: "",
    artistDataLoading: false,
    artistDataRequestId: 0,
    characterSource: getActiveCharacterSource(),
    characterData: [],
    characterDataLoadedSource: "",
    characterDataLoadedQuery: "",
    characterDataLoading: false,
    characterDataRequestId: 0,
    searchQueries: {
        artist: "",
        character: "",
        clothing: "",
        background: "",
        pose: "",
        composition: "",
        expression: "",
        lighting: "",
    },
    visibleLimits: {
        artist: PAGE_SIZE,
        character: PAGE_SIZE,
        clothing: PAGE_SIZE,
        background: PAGE_SIZE,
        pose: PAGE_SIZE,
        composition: PAGE_SIZE,
        expression: PAGE_SIZE,
        lighting: PAGE_SIZE,
    },
    resetScrollFor: {},
    imageVariants: {},
    imageFlipUntil: {},
    edits: {},
    selected: {
        artist: new Map(),
        character: new Map(),
        clothing: new Map(),
        background: new Map(),
        pose: new Map(),
        composition: new Map(),
        expression: new Map(),
        lighting: new Map(),
    },
    taxonomy: {
        character: "all",
        clothing: "all",
        background: "all",
        pose: "all",
    },
    targetIds: {},
    favoritesConfig: null,
    favoritesLoaded: false,
    customHubData: null,
    customHubLoaded: false,
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

function defaultCustomHubData() {
    const data = { categories: {}, cards: {} };
    SECTIONS.forEach(section => {
        data.categories[section.id] = [];
        data.cards[section.id] = [];
    });
    return data;
}

function normalizeCustomHubData(data) {
    const normalized = defaultCustomHubData();
    if (!data || typeof data !== "object") return normalized;
    ["categories", "cards"].forEach(bucket => {
        const source = data[bucket];
        if (!source || typeof source !== "object") return;
        SECTIONS.forEach(section => {
            const rows = source[section.id];
            normalized[bucket][section.id] = Array.isArray(rows) ? rows.filter(row => row && typeof row === "object") : [];
        });
    });
    return normalized;
}

async function loadCustomHubData() {
    if (HUB_STATE.customHubLoaded) return HUB_STATE.customHubData;
    let data = null;
    try {
        const response = await fetch("/anima-tools/custom-hub");
        if (response.ok) {
            data = await response.json();
        }
    } catch (error) {
        console.warn("[Anima Tools] Failed to load custom Hub data from server", error);
    }

    if (!data) {
        try {
            data = JSON.parse(localStorage.getItem(CUSTOM_HUB_STORAGE_KEY) || "null");
        } catch (error) {
            console.warn("[Anima Tools] Failed to load custom Hub data fallback", error);
        }
    }

    HUB_STATE.customHubData = normalizeCustomHubData(data);
    HUB_STATE.customHubLoaded = true;
    return HUB_STATE.customHubData;
}

async function saveCustomHubData() {
    const data = normalizeCustomHubData(HUB_STATE.customHubData);
    HUB_STATE.customHubData = data;
    localStorage.setItem(CUSTOM_HUB_STORAGE_KEY, JSON.stringify(data));
    try {
        await fetch("/anima-tools/custom-hub", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch (error) {
        console.warn("[Anima Tools] Failed to save custom Hub data to server", error);
    }
}

function getCustomCategories(section) {
    return normalizeCustomHubData(HUB_STATE.customHubData).categories[section] || [];
}

function getCustomCards(section) {
    return normalizeCustomHubData(HUB_STATE.customHubData).cards[section] || [];
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

function getBaseSectionData(section) {
    if (section === "artist") return HUB_STATE.artistDataLoadedSource === HUB_STATE.artistSource ? HUB_STATE.artistData : [];
    if (section === "character") return HUB_STATE.characterDataLoadedSource === HUB_STATE.characterSource ? HUB_STATE.characterData : [];
    if (section === "clothing") return window.clothingData || [];
    if (section === "background") return window.backgroundData || [];
    if (section === "pose") return window.poseData || [];
    if (section === "composition") return window.compositionData || [];
    if (section === "expression") return window.expressionData || [];
    if (section === "lighting") return window.lightingData || [];
    return [];
}

function getSectionData(section) {
    return [...getBaseSectionData(section), ...getCustomCards(section)];
}

function getItemKey(section, item) {
    if (item?.hubKey) return String(item.hubKey);
    if (item?.isCustom && item?.id) return `custom:${item.id}`;
    if (section === "artist") return `${item?.source || "theta"}:${item?.sourceKey || item?.name || item?.prompt || ""}`;
    return String(item?.id || item?.name || item?.tags || "");
}

function loadHubEdits() {
    try {
        const data = JSON.parse(localStorage.getItem(EDITS_STORAGE_KEY) || "{}");
        HUB_STATE.edits = data && typeof data === "object" ? data : {};
    } catch (error) {
        console.warn("[Anima Tools] Failed to load Hub edits", error);
        HUB_STATE.edits = {};
    }
}

function saveHubEdits() {
    localStorage.setItem(EDITS_STORAGE_KEY, JSON.stringify(HUB_STATE.edits || {}));
}

function getEditKey(section, item) {
    return `${section}:${getItemKey(section, item)}`;
}

function getItemEdit(section, item) {
    return HUB_STATE.edits?.[getEditKey(section, item)] || {};
}

function setItemEdit(section, item, patch) {
    const key = getEditKey(section, item);
    const current = HUB_STATE.edits[key] || {};
    const next = { ...current, ...patch };
    Object.keys(next).forEach(prop => {
        if (next[prop] === undefined || next[prop] === null || next[prop] === "") delete next[prop];
    });
    if (Object.keys(next).length) {
        HUB_STATE.edits[key] = next;
    } else {
        delete HUB_STATE.edits[key];
    }
    saveHubEdits();
}

function getEditedTrigger(section, item, fallback) {
    const edit = getItemEdit(section, item);
    return edit.trigger ?? fallback ?? "";
}

function getEditedTags(section, item, fallback) {
    const edit = getItemEdit(section, item);
    return edit.tags ?? fallback ?? "";
}

function getItemTitle(section, item) {
    if (item?.isCustom) return item?.name || item?.title || "";
    if (section === "artist") return item?.prompt || `@${item?.name || ""}`;
    if (section === "character") return titleCase(item?.name || "");
    return item?.name || item?.name_zh || item?.tags || "";
}

function getItemMeta(section, item) {
    if (item?.isCustom) return Array.isArray(item?.categories) ? item.categories.join(" / ") : (item?.category || "");
    if (section === "artist") return [item?.sourceLabel, `${item?.post_count ?? item?.postCount ?? 0} works`].filter(Boolean).join(" / ");
    if (section === "character") return item?.copyright || "";
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
        ...(Array.isArray(item?.taxonomyLabels) ? item.taxonomyLabels : []),
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

function getItemImageUrls(section, item) {
    const urls = Array.isArray(item?.imageUrls) ? item.imageUrls.filter(Boolean) : [];
    const primary = getItemImageUrl(section, item);
    return [...new Set([...urls, primary].filter(Boolean))];
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
    if (section === "artist") return getEditedTrigger(section, item, item?.prompt || item?.trigger || `@${item?.name || ""}`);
    if (section === "character") {
        if (item?.isCustom) {
            const trigger = getEditedTrigger(section, item, item?.trigger || item?.name || "");
            if (characterMode !== "trigger_tags") return trigger;
            const result = [];
            const seen = new Set();
            pushUniquePromptTokens(result, seen, trigger);
            pushUniquePromptTokens(result, seen, getEditedTags(section, item, item?.tags || ""));
            return result.join(", ");
        }
        const officialData = await getOfficialCharacterData(item);
        const trigger = getEditedTrigger(section, item, item?.trigger || officialData?.trigger || [item?.name, item?.copyright].filter(Boolean).join(", "));
        if (characterMode !== "trigger_tags") return trigger;

        const result = [];
        const seen = new Set();
        pushUniquePromptTokens(result, seen, trigger);
        const editedTags = getItemEdit(section, item).tags;
        if (editedTags !== undefined) {
            pushUniquePromptTokens(result, seen, editedTags);
        } else {
            pushUniquePromptTokens(result, seen, item?.tags);
            pushUniquePromptTokens(result, seen, officialData?.tags);
            pushUniquePromptTokens(result, seen, officialData?.core_tags);
            pushUniquePromptTokens(result, seen, officialData?.coreTags);
        }
        if (result.length === 1) {
            pushUniquePromptTokens(result, seen, item?.gender);
            if (item?.hair) pushUniquePromptTokens(result, seen, `${item.hair} hair`);
            if (item?.eye) pushUniquePromptTokens(result, seen, `${item.eye} eyes`);
        }
        return result.join(", ");
    }
    if (item?.isCustom) {
        const result = [];
        const seen = new Set();
        pushUniquePromptTokens(result, seen, getEditedTrigger(section, item, item?.trigger || ""));
        pushUniquePromptTokens(result, seen, getEditedTags(section, item, item?.tags || ""));
        return result.join(", ");
    }
    return splitPromptTokens(getEditedTags(section, item, item?.tags)).join(", ");
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
    if (HUB_STATE.viewMode === "selected") {
        return Array.from(HUB_STATE.selected[section].values());
    }
    return getSectionData(section);
}

function resetVisibleLimit(section) {
    HUB_STATE.visibleLimits[section] = PAGE_SIZE;
    HUB_STATE.resetScrollFor[section] = true;
}

function resetAllVisibleLimits() {
    SECTIONS.forEach(section => {
        resetVisibleLimit(section.id);
    });
}

function applyCharacterSearch(root, query) {
    const value = String(query || "").trim();
    if (!value) return;
    HUB_STATE.activeSection = "character";
    HUB_STATE.viewMode = "all";
    HUB_STATE.taxonomy.character = "all";
    HUB_STATE.searchQueries.character = value;
    resetVisibleLimit("character");
    HUB_STATE.characterData = [];
    HUB_STATE.characterDataLoadedQuery = "";
    const search = root?.querySelector(".anima-hub-search");
    if (search) search.value = value;
    renderHub(root);
}

function sectionUsesTaxonomy(section) {
    return getTaxonomyCategories(section).length > 0 || getCustomCategories(section).length > 0;
}

function getActiveTaxonomy(section) {
    return HUB_STATE.taxonomy[section] || "all";
}

function getAllAssignableCategories(section) {
    const staticCategories = getTaxonomyGroups(section).flatMap(group => (group.children || []).map(category => ({
        ...category,
        groupLabel: group.label,
        isCustom: false,
    })));
    const customCategories = getCustomCategories(section).map(category => ({
        ...category,
        label: category.label || category.name || "Custom",
        groupLabel: "自定义",
        isCustom: true,
    }));
    return [...staticCategories, ...customCategories];
}

function itemHasExplicitTaxonomy(item, categoryId) {
    return Array.isArray(item?.taxonomyIds) && item.taxonomyIds.includes(categoryId);
}

function itemMatchesHubTaxonomy(section, item, categoryId) {
    if (!categoryId || categoryId === "all") return true;
    if (itemHasExplicitTaxonomy(item, categoryId)) return true;
    if (getCustomCategories(section).some(category => category.id === categoryId)) return false;
    return itemMatchesTaxonomy(section, item, categoryId);
}

function getHubTaxonomyCounts(section, rows) {
    const counts = new Map();
    getAllAssignableCategories(section).forEach(category => {
        counts.set(category.id, 0);
    });
    rows.forEach(item => {
        getAllAssignableCategories(section).forEach(category => {
            if (itemMatchesHubTaxonomy(section, item, category.id)) {
                counts.set(category.id, (counts.get(category.id) || 0) + 1);
            }
        });
    });
    return counts;
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

function closeCustomDialog(dialog) {
    dialog?.remove();
}

async function uploadCustomCardImage(section, file) {
    if (!file) return "";
    const form = new FormData();
    form.append("section", section);
    form.append("image", file);
    const response = await fetch("/anima-tools/custom-card-image", {
        method: "POST",
        body: form,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Image upload failed");
    }
    return data.url || "";
}

function openCustomCategoryDialog(root) {
    const section = HUB_STATE.activeSection;
    const label = window.prompt("新增小分类名称");
    const name = String(label || "").trim();
    if (!name) return;
    const data = normalizeCustomHubData(HUB_STATE.customHubData);
    data.categories[section].push({
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: name,
        createdAt: new Date().toISOString(),
    });
    HUB_STATE.customHubData = data;
    saveCustomHubData().then(() => {
        renderHub(root);
        showToast("小分类已新增");
    });
}

async function deleteCustomCategory(root, section, categoryId) {
    const data = normalizeCustomHubData(HUB_STATE.customHubData);
    const category = data.categories[section].find(item => item.id === categoryId);
    if (!category) return;
    if (!window.confirm(`删除自定义小分类「${category.label || category.name || "Custom"}」？\n卡片不会被删除，只会移除这个分类归属。`)) return;

    data.categories[section] = data.categories[section].filter(item => item.id !== categoryId);
    const remainingCategories = [
        ...getTaxonomyGroups(section).flatMap(group => group.children || []),
        ...data.categories[section],
    ];
    data.cards[section] = data.cards[section].map(card => {
        const taxonomyIds = Array.isArray(card.taxonomyIds) ? card.taxonomyIds.filter(id => id !== categoryId) : [];
        const taxonomyLabels = remainingCategories
            .filter(item => taxonomyIds.includes(item.id))
            .map(item => item.label || item.name || "Custom");
        return {
            ...card,
            taxonomyIds,
            taxonomyLabels,
            categories: taxonomyLabels,
        };
    });

    HUB_STATE.customHubData = data;
    if (HUB_STATE.taxonomy[section] === categoryId) {
        HUB_STATE.taxonomy[section] = "all";
    }
    await saveCustomHubData();
    renderHub(root);
    showToast("小分类已删除");
}

function addDialogField(form, labelText, field) {
    const row = createEl("label", "anima-hub-custom-field");
    row.appendChild(createEl("span", "", labelText));
    row.appendChild(field);
    form.appendChild(row);
    return field;
}

function openCustomCardDialog(root) {
    const section = HUB_STATE.activeSection;
    const dialog = createEl("div", "anima-hub-custom-dialog");
    const panel = createEl("div", "anima-hub-custom-panel");
    const form = createEl("form", "anima-hub-custom-form");
    panel.appendChild(createEl("div", "anima-hub-custom-title", "新增卡片"));

    const title = addDialogField(form, "标题", createEl("input", "anima-hub-custom-input"));
    title.required = true;
    title.placeholder = "例如：Rainy Street";

    const trigger = addDialogField(form, "Trigger", createEl("textarea", "anima-hub-custom-input"));
    trigger.rows = 2;
    trigger.placeholder = "主要提示词";

    const tags = addDialogField(form, "Tags", createEl("textarea", "anima-hub-custom-input"));
    tags.rows = 4;
    tags.placeholder = "用逗号分隔";

    const image = addDialogField(form, "图片", createEl("input", "anima-hub-custom-input"));
    image.type = "file";
    image.accept = "image/png,image/jpeg,image/webp";

    const categorySelect = addDialogField(form, "分类归属", createEl("select", "anima-hub-custom-input"));
    categorySelect.multiple = true;
    categorySelect.size = Math.min(8, Math.max(4, getAllAssignableCategories(section).length || 4));
    getAllAssignableCategories(section).forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = `${category.groupLabel || "分类"} / ${category.label}`;
        categorySelect.appendChild(option);
    });

    const actions = createEl("div", "anima-hub-custom-actions");
    const cancel = createEl("button", "anima-hub-button", "取消");
    cancel.type = "button";
    cancel.onclick = () => closeCustomDialog(dialog);
    const submit = createEl("button", "anima-hub-button primary", "新增");
    submit.type = "submit";
    actions.appendChild(cancel);
    actions.appendChild(submit);
    form.appendChild(actions);

    form.onsubmit = async event => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = "储存中";
        try {
            const taxonomyIds = Array.from(categorySelect.selectedOptions).map(option => option.value);
            const assignable = getAllAssignableCategories(section);
            const taxonomyLabels = assignable.filter(category => taxonomyIds.includes(category.id)).map(category => category.label);
            const preview = await uploadCustomCardImage(section, image.files?.[0]);
            const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const data = normalizeCustomHubData(HUB_STATE.customHubData);
            data.cards[section].push({
                id,
                hubKey: `custom:${id}`,
                isCustom: true,
                source: "custom",
                name: title.value.trim(),
                trigger: trigger.value.trim(),
                tags: tags.value.trim(),
                preview,
                imageUrl: preview,
                taxonomyIds,
                taxonomyLabels,
                categories: taxonomyLabels,
                traits: splitPromptTokens(tags.value).slice(0, 4),
                createdAt: new Date().toISOString(),
            });
            HUB_STATE.customHubData = data;
            await saveCustomHubData();
            closeCustomDialog(dialog);
            resetVisibleLimit(section);
            renderHub(root);
            showToast("卡片已新增");
        } catch (error) {
            console.warn("[Anima Tools] Failed to add custom card", error);
            alert(error?.message || "新增卡片失败");
            submit.disabled = false;
            submit.textContent = "新增";
        }
    };

    panel.appendChild(form);
    dialog.appendChild(panel);
    dialog.addEventListener("mousedown", event => {
        if (event.target === dialog) closeCustomDialog(dialog);
    });
    document.body.appendChild(dialog);
    title.focus();
}

async function deleteCustomCard(root, section, item) {
    if (!item?.isCustom) return;
    if (!window.confirm(`删除自定义卡片「${getItemTitle(section, item)}」？`)) return;
    const data = normalizeCustomHubData(HUB_STATE.customHubData);
    data.cards[section] = data.cards[section].filter(card => card.id !== item.id);
    HUB_STATE.customHubData = data;
    HUB_STATE.selected[section]?.delete(getItemKey(section, item));
    await saveCustomHubData();
    renderHub(root);
    showToast("卡片已删除");
}

function updateCustomCardCategories(section, cardId, taxonomyIds) {
    const data = normalizeCustomHubData(HUB_STATE.customHubData);
    const card = data.cards[section].find(item => item.id === cardId);
    if (!card) return false;
    const assignable = getAllAssignableCategories(section);
    const taxonomyLabels = assignable.filter(category => taxonomyIds.includes(category.id)).map(category => category.label);
    card.taxonomyIds = taxonomyIds;
    card.taxonomyLabels = taxonomyLabels;
    card.categories = taxonomyLabels;
    HUB_STATE.customHubData = data;
    return true;
}

function openCustomCardCategoryDialog(root, section, item) {
    if (!item?.isCustom) return;
    const dialog = createEl("div", "anima-hub-custom-dialog");
    const panel = createEl("div", "anima-hub-custom-panel");
    const form = createEl("form", "anima-hub-custom-form");
    panel.appendChild(createEl("div", "anima-hub-custom-title", "调整分类"));

    const categorySelect = addDialogField(form, "分类归属", createEl("select", "anima-hub-custom-input"));
    categorySelect.multiple = true;
    const assignable = getAllAssignableCategories(section);
    const activeIds = new Set(Array.isArray(item.taxonomyIds) ? item.taxonomyIds : []);
    categorySelect.size = Math.min(10, Math.max(4, assignable.length || 4));
    assignable.forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = `${category.groupLabel || "分类"} / ${category.label}`;
        option.selected = activeIds.has(category.id);
        categorySelect.appendChild(option);
    });

    const actions = createEl("div", "anima-hub-custom-actions");
    const cancel = createEl("button", "anima-hub-button", "取消");
    cancel.type = "button";
    cancel.onclick = () => closeCustomDialog(dialog);
    const submit = createEl("button", "anima-hub-button primary", "保存");
    submit.type = "submit";
    actions.appendChild(cancel);
    actions.appendChild(submit);
    form.appendChild(actions);

    form.onsubmit = async event => {
        event.preventDefault();
        const taxonomyIds = Array.from(categorySelect.selectedOptions).map(option => option.value);
        if (!updateCustomCardCategories(section, item.id, taxonomyIds)) {
            alert("找不到这张自定义卡片");
            return;
        }
        await saveCustomHubData();
        closeCustomDialog(dialog);
        renderHub(root);
        showToast("分类已更新");
    };

    panel.appendChild(form);
    dialog.appendChild(panel);
    dialog.addEventListener("mousedown", event => {
        if (event.target === dialog) closeCustomDialog(dialog);
    });
    document.body.appendChild(dialog);
    categorySelect.focus();
}

async function getDisplayTags(section, item) {
    const editedTags = getItemEdit(section, item).tags;
    if (editedTags !== undefined) return splitPromptTokens(editedTags);
    if (item?.isCustom) return splitPromptTokens(item?.tags);
    if (section === "artist") return splitPromptTokens(item?.name);
    if (section === "character") {
        const officialData = await getOfficialCharacterData(item);
        const tags = [];
        const seen = new Set();
        pushUniquePromptTokens(tags, seen, item?.tags);
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

function toggleCardSelection(root, section, item, characterMode = "trigger") {
    const key = getItemKey(section, item);
    const selected = HUB_STATE.selected[section];
    if (!selected) return;
    if (selected.has(key)) {
        selected.delete(key);
    } else {
        selected.set(key, getSelectedItem(section, item, section === "character" ? characterMode : "trigger"));
    }
    renderHub(root);
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

async function refreshCharacterData(root) {
    const source = HUB_STATE.characterSource;
    const requestId = ++HUB_STATE.characterDataRequestId;
    const query = root?.querySelector(".anima-hub-search")?.value?.trim?.() || "";
    HUB_STATE.characterDataLoading = true;

    const data = await getCharacterDataForSource(source, query);
    if (requestId !== HUB_STATE.characterDataRequestId || source !== HUB_STATE.characterSource) {
        return;
    }

    HUB_STATE.characterData = data;
    HUB_STATE.characterDataLoadedSource = source;
    HUB_STATE.characterDataLoadedQuery = query;
    HUB_STATE.characterDataLoading = false;
    if (root && activeHub?.contains(root)) {
        renderHub(root);
    }
}

async function loadMoreCharacterData(root) {
    if (HUB_STATE.characterDataLoading) return;
    const source = HUB_STATE.characterSource;
    const query = root?.querySelector(".anima-hub-search")?.value?.trim?.() || "";
    if (!hasMoreCharacterDataForSource(source, query)) return;

    HUB_STATE.characterDataLoading = true;
    renderHub(root);
    const data = await loadMoreCharacterDataForSource(source, query);
    const activeQuery = root?.querySelector(".anima-hub-search")?.value?.trim?.() || "";
    if (source !== HUB_STATE.characterSource || query !== activeQuery) {
        HUB_STATE.characterDataLoading = false;
        return;
    }

    HUB_STATE.characterData = data;
    HUB_STATE.characterDataLoadedSource = source;
    HUB_STATE.characterDataLoadedQuery = query;
    HUB_STATE.characterDataLoading = false;
    HUB_STATE.visibleLimits.character = (HUB_STATE.visibleLimits.character || PAGE_SIZE) + PAGE_SIZE;
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

function ensureCharacterData(root) {
    if (HUB_STATE.activeSection !== "character") return;
    const query = root?.querySelector(".anima-hub-search")?.value?.trim?.() || "";
    if (HUB_STATE.characterDataLoadedSource === HUB_STATE.characterSource && HUB_STATE.characterDataLoadedQuery === query) return;
    if (HUB_STATE.characterDataLoading) return;
    refreshCharacterData(root);
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
            width: min(1540px, 98vw);
            height: min(920px, 94vh);
            background: #15171b;
            color: #f4f4f5;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.58);
            display: grid;
            grid-template-rows: auto 1fr auto;
            overflow: hidden;
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .anima-hub-header,
        .anima-hub-footer {
            padding: 14px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .anima-hub-header {
            border-bottom: 1px solid rgba(255,255,255,0.09);
        }
        .anima-hub-body {
            min-height: 0;
            display: grid;
            grid-template-columns: 260px minmax(0, 1fr);
            overflow: hidden;
        }
        .anima-hub-sidebar {
            min-height: 0;
            overflow: auto;
            border-right: 1px solid rgba(255,255,255,0.09);
            background: #121419;
            padding: 14px 12px;
            box-sizing: border-box;
        }
        .anima-hub-main {
            min-width: 0;
            min-height: 0;
            display: grid;
            grid-template-rows: auto 1fr;
            overflow: hidden;
        }
        .anima-hub-toolbar {
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.09);
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }
        .anima-hub-taxonomy {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .anima-hub-taxonomy.hidden {
            display: none;
        }
        .anima-hub-taxonomy-label {
            margin: 0 2px 2px;
            color: #a1a1aa;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .anima-hub-taxonomy-options {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .anima-hub-taxonomy-group {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .anima-hub-taxonomy-group-title {
            color: #71717a;
            font-size: 11px;
            font-weight: 850;
            padding: 0 2px;
        }
        .anima-hub-taxonomy-chip {
            min-height: 32px;
            border: 1px solid rgba(255,255,255,0.12);
            background: transparent;
            color: #d4d4d8;
            border-radius: 7px;
            padding: 6px 9px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 750;
            text-align: left;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }
        .anima-hub-taxonomy-chip.active {
            background: rgba(56,189,248,0.16);
            border-color: rgba(56,189,248,0.48);
            color: #ffffff;
        }
        .anima-hub-taxonomy-chip:disabled {
            opacity: 0.42;
            cursor: not-allowed;
        }
        .anima-hub-taxonomy-count {
            color: #a1a1aa;
            font-weight: 750;
        }
        .anima-hub-taxonomy-custom-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 6px;
            align-items: stretch;
        }
        .anima-hub-taxonomy-delete {
            min-height: 32px;
            border: 1px solid rgba(248,113,113,0.32);
            background: rgba(127,29,29,0.24);
            color: #fecaca;
            border-radius: 7px;
            padding: 0 8px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 800;
        }
        .anima-hub-taxonomy-delete:hover {
            background: rgba(220,38,38,0.34);
            border-color: rgba(248,113,113,0.58);
            color: #ffffff;
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
            flex-direction: column;
            gap: 7px;
        }
        .anima-hub-tab {
            width: 100%;
            text-align: left;
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
            width: min(420px, 36vw);
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
        .anima-hub-custom-tools {
            display: flex;
            gap: 8px;
        }
        .anima-hub-grid {
            padding: 14px 16px 18px;
            overflow: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
            gap: 14px;
            align-content: start;
        }
        .anima-hub-card {
            position: relative;
            height: clamp(375px, 28.5vw, 525px);
            min-height: 375px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.09);
            background: rgba(255,255,255,0.035);
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 0;
            box-sizing: border-box;
            overflow: hidden;
            transform: translateY(0) scale(1);
            transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
            will-change: transform;
            cursor: pointer;
        }
        .anima-hub-card:hover {
            transform: translateY(-4px) scale(1.012);
            border-color: rgba(255,255,255,0.2);
            box-shadow: 0 16px 36px rgba(0,0,0,0.34);
        }
        .anima-hub-card.selected {
            border-color: rgba(56,189,248,0.9);
            box-shadow:
                0 0 0 2px rgba(56,189,248,0.72),
                0 0 0 5px rgba(14,165,233,0.18),
                0 18px 42px rgba(14,165,233,0.2);
            background: rgba(56,189,248,0.1);
        }
        .anima-hub-card.selected::after {
            content: "Selected";
            position: absolute;
            left: 10px;
            top: 10px;
            z-index: 5;
            padding: 5px 8px;
            border-radius: 999px;
            background: rgba(14,165,233,0.92);
            color: #ffffff;
            font-size: 11px;
            font-weight: 850;
            box-shadow: 0 8px 22px rgba(0,0,0,0.38);
            pointer-events: none;
        }
        .anima-hub-thumb {
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 375px;
            border-radius: 0;
            overflow: hidden;
            background: #202329;
            border: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #71717a;
            font-size: 12px;
            perspective: 900px;
        }
        .anima-hub-thumb-bg {
            position: absolute;
            inset: -14px;
            z-index: 0;
            background-position: center;
            background-size: cover;
            filter: blur(18px) saturate(1.08);
            opacity: 0.58;
            transform: scale(1.04);
            transition: background-image 0.18s ease, opacity 0.22s ease, transform 0.28s ease;
        }
        .anima-hub-card:hover .anima-hub-thumb-bg {
            opacity: 0.72;
            transform: scale(1.08);
        }
        .anima-hub-thumb-bg::after {
            content: "";
            position: absolute;
            inset: 0;
            background: rgba(8,10,15,0.18);
        }
        .anima-hub-thumb-image-wrap {
            position: relative;
            z-index: 1;
            width: 100%;
            height: 100%;
            min-height: 375px;
            transform-style: preserve-3d;
            transition: transform 0.26s ease, filter 0.26s ease;
        }
        .anima-hub-card:hover .anima-hub-thumb-image-wrap {
            transform: translateZ(18px) scale(1.01);
            filter: saturate(1.08);
        }
        .anima-hub-card.flipping .anima-hub-thumb-image-wrap {
            animation: anima-card-flip 0.62s cubic-bezier(.2,.72,.22,1);
        }
        .anima-hub-thumb-image-wrap img {
            width: 100%;
            height: 100%;
            min-height: 375px;
            object-fit: contain;
            object-position: center;
            display: block;
            background: transparent;
            backface-visibility: hidden;
        }
        .anima-hub-variant-toggle {
            min-width: 36px;
            height: 28px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.22);
            background: rgba(0,0,0,0.58);
            color: #ffffff;
            cursor: pointer;
            font-size: 12px;
            font-weight: 850;
            box-shadow: 0 10px 24px rgba(0,0,0,0.34);
            transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }
        .anima-hub-variant-toggle:hover {
            transform: translateY(-1px) scale(1.06);
            background: rgba(14,165,233,0.82);
            border-color: rgba(125,211,252,0.78);
        }
        .anima-hub-variant-toggle:active {
            transform: translateY(0) scale(0.96);
        }
        .anima-hub-overlay-panel {
            position: absolute;
            inset: 0;
            z-index: 3;
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.22s ease, backdrop-filter 0.22s ease;
            background: linear-gradient(to bottom, rgba(7,7,12,0.76), rgba(7,7,12,0.46) 48%, rgba(7,7,12,0.88));
            backdrop-filter: blur(0);
        }
        .anima-hub-thumb:hover .anima-hub-overlay-panel,
        .anima-hub-overlay-panel:focus-within {
            opacity: 1;
            pointer-events: auto;
            backdrop-filter: blur(1.5px);
        }
        .anima-hub-overlay-top {
            flex: 0 0 auto;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 12px 0;
        }
        .anima-hub-overlay-icon {
            width: 32px;
            height: 32px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.24);
            background: rgba(0,0,0,0.42);
            color: #ffffff;
            cursor: pointer;
            font-size: 18px;
            font-weight: 850;
            line-height: 1;
            transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }
        .anima-hub-overlay-icon:hover {
            transform: translateY(-1px) scale(1.06);
        }
        .anima-hub-overlay-icon.active {
            background: rgba(14,165,233,0.72);
            border-color: rgba(125,211,252,0.7);
        }
        .anima-hub-overlay-icon:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            transform: none;
        }
        .anima-hub-overlay-scroll {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding: 8px 13px 6px;
        }
        .anima-hub-overlay-label {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: #ffffff;
            margin-bottom: 5px;
        }
        .anima-hub-overlay-label-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 5px;
        }
        .anima-hub-overlay-label-row .anima-hub-overlay-label {
            margin-bottom: 0;
        }
        .anima-hub-edit-mini {
            border: 1px solid rgba(255,255,255,0.18);
            background: rgba(255,255,255,0.08);
            color: #f4f4f5;
            border-radius: 999px;
            padding: 2px 7px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 800;
        }
        .anima-hub-edit-mini:hover {
            background: rgba(14,165,233,0.34);
            border-color: rgba(56,189,248,0.58);
        }
        .anima-hub-inline-edit {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            margin-bottom: 10px;
        }
        .anima-hub-inline-editor {
            width: 100%;
            min-height: 42px;
            resize: vertical;
            box-sizing: border-box;
            border-radius: 8px;
            border: 1px solid #22d3ee;
            background: rgba(79,70,229,0.76);
            color: #ffffff;
            padding: 8px 9px;
            font: inherit;
            font-size: 12px;
            font-weight: 750;
            line-height: 1.45;
            outline: none;
            box-shadow: 0 0 0 1px rgba(34,211,238,0.38);
        }
        .anima-hub-inline-editor::selection {
            background: rgba(168,85,247,0.72);
            color: #ffffff;
        }
        .anima-hub-inline-save {
            min-height: 24px;
            border: 1px solid rgba(255,255,255,0.18);
            background: rgba(255,255,255,0.08);
            color: #f4f4f5;
            border-radius: 999px;
            padding: 3px 9px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 800;
        }
        .anima-hub-inline-save:hover {
            background: rgba(14,165,233,0.34);
            border-color: rgba(56,189,248,0.58);
        }
        .anima-hub-editable-line {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            margin-bottom: 10px;
        }
        .anima-hub-editable-line .anima-hub-overlay-trigger {
            flex: 1;
            margin-bottom: 0;
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
        button.anima-hub-tag-chip {
            cursor: pointer;
            text-align: left;
            font-family: inherit;
        }
        button.anima-hub-tag-chip:hover {
            background: rgba(14,165,233,0.34);
            border-color: rgba(56,189,248,0.58);
        }
        .anima-hub-overlay-actions {
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px 8px 92px;
        }
        .anima-hub-overlay-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
        }
        .anima-hub-overlay-row.single {
            grid-template-columns: 1fr;
        }
        .anima-hub-overlay-row.centered {
            width: min(160px, 70%);
            align-self: center;
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
            transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .anima-hub-overlay-action:hover,
        .anima-hub-overlay-action.primary {
            background: #0ea5e9;
            border-color: #38bdf8;
            color: #ffffff;
        }
        .anima-hub-overlay-action:hover {
            transform: translateY(-1px);
        }
        .anima-hub-overlay-action:active {
            transform: translateY(1px) scale(0.98);
        }
        .anima-hub-overlay-action:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background: rgba(255,255,255,0.05);
            border-color: rgba(255,255,255,0.12);
            color: #a1a1aa;
        }
        .anima-hub-load-more {
            grid-column: 1 / -1;
            padding: 10px 0 4px;
            color: #a1a1aa;
            font-size: 12px;
            text-align: center;
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
            padding: 10px 11px 11px;
        }
        .anima-hub-card-caption {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 4;
            padding: 14px 14px 16px;
            background: linear-gradient(to top, rgba(11,16,24,0.96), rgba(11,16,24,0.78) 72%, rgba(11,16,24,0));
            pointer-events: none;
            transition: padding-bottom 0.2s ease, background 0.2s ease;
        }
        .anima-hub-card:hover .anima-hub-card-caption {
            padding-bottom: 18px;
            background: linear-gradient(to top, rgba(8,13,20,0.98), rgba(8,13,20,0.74) 72%, rgba(8,13,20,0));
        }
        .anima-hub-card-caption .anima-hub-card-title {
            padding: 0;
            font-size: 16px;
        }
        .anima-hub-card-caption .anima-hub-card-meta {
            padding: 4px 0 0;
            text-transform: uppercase;
            font-size: 11px;
            font-weight: 800;
            color: #a9a6c8;
        }
        .anima-hub-meta-link {
            display: inline;
            border: 0;
            background: transparent;
            color: #a9a6c8;
            cursor: pointer;
            font: inherit;
            letter-spacing: inherit;
            padding: 0;
            text-align: left;
            text-transform: uppercase;
            pointer-events: auto;
        }
        .anima-hub-meta-link:hover {
            color: #ffffff;
            text-decoration: underline;
            text-underline-offset: 3px;
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
        .anima-hub-custom-dialog {
            position: fixed;
            inset: 0;
            z-index: 100003;
            background: rgba(3,7,18,0.72);
            display: grid;
            place-items: center;
            padding: 22px;
        }
        .anima-hub-custom-panel {
            width: min(520px, 94vw);
            max-height: min(720px, 92vh);
            overflow: auto;
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 10px;
            background: #14171d;
            box-shadow: 0 24px 72px rgba(0,0,0,0.52);
            padding: 18px;
            box-sizing: border-box;
        }
        .anima-hub-custom-title {
            font-size: 16px;
            font-weight: 850;
            color: #ffffff;
            margin-bottom: 14px;
        }
        .anima-hub-custom-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .anima-hub-custom-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            color: #d4d4d8;
            font-size: 12px;
            font-weight: 800;
        }
        .anima-hub-custom-input {
            width: 100%;
            box-sizing: border-box;
            border-radius: 7px;
            border: 1px solid rgba(255,255,255,0.14);
            background: #202329;
            color: #f4f4f5;
            padding: 9px 10px;
            font: inherit;
            font-size: 13px;
            outline: none;
        }
        textarea.anima-hub-custom-input {
            resize: vertical;
        }
        select.anima-hub-custom-input {
            min-height: 112px;
        }
        .anima-hub-custom-input:focus {
            border-color: rgba(56,189,248,0.64);
            box-shadow: 0 0 0 2px rgba(14,165,233,0.16);
        }
        .anima-hub-custom-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 4px;
        }
        @keyframes anima-card-flip {
            0% {
                transform: rotateY(0deg) translateZ(0);
                filter: brightness(1);
            }
            50% {
                transform: rotateY(180deg) translateZ(20px);
                filter: brightness(1.28) saturate(1.18);
            }
            100% {
                transform: rotateY(360deg) translateZ(0);
                filter: brightness(1);
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .anima-hub-card,
            .anima-hub-thumb-bg,
            .anima-hub-thumb-image-wrap,
            .anima-hub-overlay-panel,
            .anima-hub-overlay-icon,
            .anima-hub-variant-toggle,
            .anima-hub-card-caption,
            .anima-hub-overlay-action {
                transition: none;
                animation: none;
            }
            .anima-hub-card:hover,
            .anima-hub-card:hover .anima-hub-thumb-image-wrap,
            .anima-hub-card:hover .anima-hub-thumb-bg {
                transform: none;
            }
        }
        @media (max-width: 920px) {
            .anima-hub {
                width: 98vw;
            }
            .anima-hub-body {
                grid-template-columns: 1fr;
                grid-template-rows: auto 1fr;
            }
            .anima-hub-sidebar {
                max-height: 240px;
                border-right: 0;
                border-bottom: 1px solid rgba(255,255,255,0.09);
            }
            .anima-hub-tabs,
            .anima-hub-taxonomy-options {
                flex-direction: row;
                overflow-x: auto;
                padding-bottom: 2px;
            }
            .anima-hub-taxonomy-group {
                min-width: min(260px, 78vw);
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
        if (button.dataset.view === "selected") {
            const selectedCount = HUB_STATE.selected[HUB_STATE.activeSection]?.size || 0;
            button.textContent = `Selected ${selectedCount}`;
        }
    });
}

function sectionUsesSourceSelect(section) {
    return section === "artist";
}

function sectionUsesSourceStatus(section) {
    return section === "artist" || section === "character";
}

function getSourcesForSection(section) {
    if (section === "artist") return ARTIST_SOURCES;
    if (section === "character") return CHARACTER_SOURCES;
    return [];
}

function getActiveSourceForSection(section) {
    if (section === "artist") return HUB_STATE.artistSource;
    if (section === "character") return HUB_STATE.characterSource;
    return "";
}

function getSourceStatusForSection(section) {
    if (section === "artist") {
        return HUB_STATE.artistDataLoading ? "正在载入画师..." : getArtistSourceStatus(HUB_STATE.artistSource);
    }
    if (section === "character") {
        return getCharacterSourceStatus(HUB_STATE.characterSource) || (HUB_STATE.characterDataLoading ? "正在载入人物..." : "");
    }
    return "";
}

function syncSourceSelect(sourceSelect, section) {
    const sources = getSourcesForSection(section);
    const optionKey = sources.map(source => source.id).join("|");
    if (sourceSelect.dataset.optionsKey !== optionKey) {
        sourceSelect.innerHTML = "";
        sources.forEach(source => {
            const option = document.createElement("option");
            option.value = source.id;
            option.textContent = source.label;
            sourceSelect.appendChild(option);
        });
        sourceSelect.dataset.optionsKey = optionKey;
    }
    sourceSelect.value = getActiveSourceForSection(section);
}

function renderTaxonomyBar(root, section, rows) {
    const bar = root.querySelector(".anima-hub-taxonomy");
    if (!bar) return;

    bar.innerHTML = "";
    if (!sectionUsesTaxonomy(section)) {
        bar.classList.add("hidden");
        return;
    }

    bar.classList.remove("hidden");
    bar.appendChild(createEl("div", "anima-hub-taxonomy-label", "子分类"));

    const activeId = getActiveTaxonomy(section);
    const counts = getHubTaxonomyCounts(section, rows);

    const allButton = createEl("button", activeId === "all" ? "anima-hub-taxonomy-chip active" : "anima-hub-taxonomy-chip", "全部");
    allButton.type = "button";
    allButton.onclick = () => {
        HUB_STATE.taxonomy[section] = "all";
        resetVisibleLimit(section);
        renderHub(root);
    };
    allButton.appendChild(createEl("span", "anima-hub-taxonomy-count", rows.length.toLocaleString()));
    bar.appendChild(allButton);

    const groups = [...getTaxonomyGroups(section)];
    const customCategories = getCustomCategories(section);
    if (customCategories.length) {
        groups.push({
            id: "custom",
            label: "自定义",
            children: customCategories.map(category => ({
                ...category,
                label: category.label || category.name || "Custom",
                isCustom: true,
            })),
        });
    }

    groups.forEach(group => {
        const groupEl = createEl("div", "anima-hub-taxonomy-group");
        groupEl.appendChild(createEl("div", "anima-hub-taxonomy-group-title", group.label));

        const options = createEl("div", "anima-hub-taxonomy-options");
        (group.children || []).forEach(category => {
            const count = counts.get(category.id) || 0;
            const button = createEl("button", activeId === category.id ? "anima-hub-taxonomy-chip active" : "anima-hub-taxonomy-chip", category.label);
            button.type = "button";
            button.disabled = count === 0;
            button.onclick = () => {
                HUB_STATE.taxonomy[section] = category.id;
                resetVisibleLimit(section);
                renderHub(root);
            };
            button.appendChild(createEl("span", "anima-hub-taxonomy-count", count.toLocaleString()));
            if (category.isCustom) {
                const row = createEl("div", "anima-hub-taxonomy-custom-row");
                const remove = createEl("button", "anima-hub-taxonomy-delete", "删除");
                remove.type = "button";
                remove.title = `删除 ${category.label}`;
                remove.onclick = event => {
                    event.stopPropagation();
                    deleteCustomCategory(root, section, category.id);
                };
                row.appendChild(button);
                row.appendChild(remove);
                options.appendChild(row);
            } else {
                options.appendChild(button);
            }
        });

        groupEl.appendChild(options);
        bar.appendChild(groupEl);
    });
}

function createOverlayButton(label, onClick, primary = false) {
    const button = createEl("button", primary ? "anima-hub-overlay-action primary" : "anima-hub-overlay-action", label);
    button.type = "button";
    button.onclick = event => {
        event.stopPropagation();
        onClick(event);
    };
    return button;
}

function createEditButton(label, onClick) {
    const button = createEl("button", "anima-hub-edit-mini", label);
    button.type = "button";
    button.onclick = event => {
        event.stopPropagation();
        onClick();
    };
    return button;
}

function saveInlineEdit(root, section, item, field, value) {
    const label = field === "trigger" ? "Trigger" : "Tags";
    setItemEdit(section, item, { [field]: String(value || "").trim() });
    renderHub(root);
    showToast(`${label} updated`);
}

function startInlineEdit(root, section, item, field, mount, currentValue) {
    const label = field === "trigger" ? "Trigger" : "Tags";
    mount.dataset.editing = "true";
    mount.innerHTML = "";

    const wrap = createEl("div", "anima-hub-inline-edit");
    const textarea = createEl("textarea", "anima-hub-inline-editor");
    textarea.value = currentValue || "";
    textarea.rows = field === "tags" ? 4 : 2;
    textarea.addEventListener("mousedown", event => event.stopPropagation());
    textarea.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            saveInlineEdit(root, section, item, field, textarea.value);
        }
        if (event.key === "Escape") {
            renderHub(root);
        }
    });

    const save = createEl("button", "anima-hub-inline-save", `↙ ${label}`);
    save.type = "button";
    save.onclick = event => {
        event.stopPropagation();
        saveInlineEdit(root, section, item, field, textarea.value);
    };

    wrap.appendChild(textarea);
    wrap.appendChild(save);
    mount.appendChild(wrap);
    setTimeout(() => {
        textarea.focus();
        textarea.select();
    }, 0);
}

function fillOverlayTags(tagContainer, tags, onTagClick = null, editButton = null) {
    if (tagContainer.dataset.editing === "true") return;
    tagContainer.innerHTML = "";
    const limited = tags.slice(0, 18);
    if (!limited.length) {
        tagContainer.appendChild(createEl("span", "anima-hub-tag-chip", "No tags"));
    } else {
        limited.forEach(tag => {
            if (onTagClick) {
                const button = createEl("button", "anima-hub-tag-chip", tag);
                button.type = "button";
                button.title = `Search ${tag}`;
                button.onclick = event => {
                    event.stopPropagation();
                    onTagClick(tag);
                };
                tagContainer.appendChild(button);
                return;
            }
            tagContainer.appendChild(createEl("span", "anima-hub-tag-chip", tag));
        });
    }
    if (editButton) tagContainer.appendChild(editButton);
}

function createCardCaption(root, section, item) {
    const caption = createEl("div", "anima-hub-card-caption");
    caption.appendChild(createEl("div", "anima-hub-card-title", getItemTitle(section, item)));

    const metaText = getItemMeta(section, item) || item?.tags || "";
    const meta = createEl("div", "anima-hub-card-meta");
    if (section === "character" && item?.copyright) {
        const series = createEl("button", "anima-hub-meta-link", item.copyright);
        series.type = "button";
        series.title = `Search ${item.copyright}`;
        series.onclick = event => {
            event.stopPropagation();
            applyCharacterSearch(root, item.copyright);
        };
        meta.appendChild(series);
    } else {
        meta.textContent = metaText;
    }
    caption.appendChild(meta);
    return caption;
}

function createCardOverlay(root, section, item, imageUrl, imageUrls = [], variantIndex = 0) {
    const key = getItemKey(section, item);
    const selected = HUB_STATE.selected[section].get(key);
    const selectedMode = selected?._hubCharacterMode || "";
    const danbooruUrl = getDanbooruUrl(section, item);
    const showSourceButton = section === "artist" || section === "character";
    const favoriteMap = getFavoritesMap(section);

    const overlay = createEl("div", "anima-hub-overlay-panel");
    const top = createEl("div", "anima-hub-overlay-top");
    const fullImageIcon = createEl("button", "anima-hub-overlay-icon", "⛶");
    fullImageIcon.type = "button";
    fullImageIcon.title = "Full image";
    fullImageIcon.disabled = !imageUrl;
    fullImageIcon.onclick = event => {
        event.stopPropagation();
        if (imageUrl) openImagePreview(imageUrl, getItemTitle(section, item));
    };
    top.appendChild(fullImageIcon);
    if (imageUrls.length > 1) {
        const variantButton = createEl("button", "anima-hub-variant-toggle", `#${variantIndex + 1}`);
        variantButton.type = "button";
        variantButton.title = "Switch image";
        variantButton.onclick = event => {
            event.stopPropagation();
            HUB_STATE.imageVariants[key] = (variantIndex + 1) % imageUrls.length;
            HUB_STATE.imageFlipUntil[key] = Date.now() + 720;
            renderHub(root);
        };
        top.appendChild(variantButton);
    }
    const favorite = createEl("button", favoriteMap.has(key) ? "anima-hub-overlay-icon active" : "anima-hub-overlay-icon", favoriteMap.has(key) ? "♥" : "♡");
    favorite.type = "button";
    favorite.title = favoriteMap.has(key) ? "移除收藏" : "加入收藏";
    favorite.onclick = async event => {
        event.stopPropagation();
        favorite.disabled = true;
        await toggleFavorite(section, item);
        renderHub(root);
    };
    top.appendChild(favorite);
    overlay.appendChild(top);

    const scroll = createEl("div", "anima-hub-overlay-scroll");
    const triggerRow = createEl("div", "anima-hub-overlay-label-row");
    triggerRow.appendChild(createEl("div", "anima-hub-overlay-label", "Trigger"));
    const trigger = createEl("div", "anima-hub-overlay-trigger", section === "artist" ? `@${item?.name || ""}` : getItemTitle(section, item));
    scroll.appendChild(triggerRow);
    getPromptForItem(section, item, "trigger").then(prompt => {
        if (prompt) trigger.textContent = prompt;
    });
    const triggerMount = createEl("div", "anima-hub-editable-line");
    triggerMount.appendChild(trigger);
    triggerMount.appendChild(createEditButton("✎", async () => {
        startInlineEdit(root, section, item, "trigger", triggerMount, await getPromptForItem(section, item, "trigger"));
    }));
    scroll.appendChild(triggerMount);

    const tagsRow = createEl("div", "anima-hub-overlay-label-row");
    tagsRow.appendChild(createEl("div", "anima-hub-overlay-label", "Tags"));
    scroll.appendChild(tagsRow);
    const tagList = createEl("div", "anima-hub-tag-list");
    const onTagClick = section === "character" ? tag => applyCharacterSearch(root, tag) : null;
    const createTagsEditButton = tags => createEditButton("✎", () => {
        startInlineEdit(root, section, item, "tags", tagList, tags.join(", "));
    });
    const initialTags = splitPromptTokens(getEditedTags(section, item, item?.tags || item?.name || ""));
    fillOverlayTags(tagList, initialTags, onTagClick, createTagsEditButton(initialTags));
    getDisplayTags(section, item).then(tags => fillOverlayTags(tagList, tags, onTagClick, createTagsEditButton(tags)));
    scroll.appendChild(tagList);

    const actions = createEl("div", "anima-hub-overlay-actions");
    const createSourceButton = () => createOverlayButton("Danbooru", () => {
        if (danbooruUrl) window.open(danbooruUrl, "_blank", "noopener,noreferrer");
    });

    if (section === "character") {
        const selectRow = createEl("div", "anima-hub-overlay-row");
        selectRow.appendChild(createOverlayButton("Trigger", () => {
            if (selectedMode === "trigger") {
                HUB_STATE.selected[section].delete(key);
            } else {
                HUB_STATE.selected[section].set(key, getSelectedItem(section, item, "trigger"));
            }
            renderHub(root);
        }, selectedMode === "trigger"));
        selectRow.appendChild(createOverlayButton("Trigger + tags", () => {
            if (selectedMode === "trigger_tags") {
                HUB_STATE.selected[section].delete(key);
            } else {
                HUB_STATE.selected[section].set(key, getSelectedItem(section, item, "trigger_tags"));
            }
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

        const sourceRow = createEl("div", "anima-hub-overlay-row single");
        const sourceButton = createSourceButton();
        sourceButton.disabled = !danbooruUrl;
        sourceRow.appendChild(sourceButton);
        actions.appendChild(sourceRow);
    } else {
        const actionRow = createEl("div", item?.isCustom ? "anima-hub-overlay-row" : "anima-hub-overlay-row single centered");
        actionRow.appendChild(createOverlayButton("Copy", async () => {
            const prompt = await getPromptForItem(section, item);
            await copyText(prompt ? `${prompt}, ` : "");
        }));
        if (item?.isCustom) {
            actionRow.appendChild(createOverlayButton("删除", () => deleteCustomCard(root, section, item)));
            const categoryRow = createEl("div", "anima-hub-overlay-row single centered");
            categoryRow.appendChild(createOverlayButton("分类", () => openCustomCardCategoryDialog(root, section, item)));
            actions.appendChild(actionRow);
            actions.appendChild(categoryRow);
        } else {
            actions.appendChild(actionRow);
        }
        if (showSourceButton) {
            const sourceRow = createEl("div", "anima-hub-overlay-row single");
            const sourceButton = createSourceButton();
            sourceButton.disabled = !danbooruUrl;
            sourceRow.appendChild(sourceButton);
            actions.appendChild(sourceRow);
        }
    }

    if (section === "character" && item?.isCustom) {
        const customRow = createEl("div", "anima-hub-overlay-row");
        customRow.appendChild(createOverlayButton("分类", () => openCustomCardCategoryDialog(root, section, item)));
        customRow.appendChild(createOverlayButton("删除", () => deleteCustomCard(root, section, item)));
        actions.appendChild(customRow);
    }

    overlay.appendChild(scroll);
    overlay.appendChild(actions);
    return overlay;
}

function shouldIgnoreCardToggle(event) {
    const target = event.target;
    if (!(target instanceof Element)) return true;
    if (target.closest("button, input, textarea, select, a")) return true;
    if (target.closest(".anima-hub-inline-edit")) return true;
    if (target.closest(".anima-hub-overlay-trigger, .anima-hub-tag-list, .anima-hub-overlay-label-row")) return true;
    return false;
}

function renderHub(root) {
    const section = HUB_STATE.activeSection;
    const sectionDef = SECTIONS.find(item => item.id === section) || SECTIONS[0];
    const searchInput = root.querySelector(".anima-hub-search");
    if (searchInput && document.activeElement !== searchInput) {
        searchInput.value = HUB_STATE.searchQueries[section] || "";
    }
    const query = searchInput?.value?.trim?.().toLowerCase() || "";
    const targets = resolveAnimaTargets(section, HUB_STATE.preferredNode);
    const targetSelect = root.querySelector(".anima-hub-target");
    const sourceSelect = root.querySelector(".anima-hub-artist-source");
    const sourceStatus = root.querySelector(".anima-hub-source-status");

    ensureArtistData(root);
    ensureCharacterData(root);

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
        sourceSelect.style.display = sectionUsesSourceSelect(section) ? "" : "none";
        if (sectionUsesSourceSelect(section)) {
            syncSourceSelect(sourceSelect, section);
        }
    }
    if (sourceStatus) {
        sourceStatus.style.display = sectionUsesSourceStatus(section) ? "" : "none";
        sourceStatus.textContent = getSourceStatusForSection(section);
    }

    const allData = getVisibleData(section);
    renderTaxonomyBar(root, section, allData);

    const selectedMap = HUB_STATE.selected[section];
    const favoriteMap = getFavoritesMap(section);
    const taxonomyId = getActiveTaxonomy(section);
    const taxonomyFiltered = HUB_STATE.viewMode === "selected" ? allData : allData.filter(item => itemMatchesHubTaxonomy(section, item, taxonomyId));
    const matching = HUB_STATE.viewMode === "selected" ? taxonomyFiltered : taxonomyFiltered.filter(item => !query || getSearchText(section, item).includes(query));
    const visibleLimit = HUB_STATE.visibleLimits[section] || PAGE_SIZE;
    const filtered = matching.slice(0, visibleLimit);

    const grid = root.querySelector(".anima-hub-grid");
    const previousSection = grid.dataset.section || "";
    const shouldResetScroll = !!HUB_STATE.resetScrollFor[section];
    const previousScrollTop = !shouldResetScroll && previousSection === section ? grid.scrollTop : 0;
    delete HUB_STATE.resetScrollFor[section];
    grid.dataset.section = section;
    grid.dataset.matchingTotal = String(matching.length);
    grid.innerHTML = "";
    if (!allData.length) {
        const sourceStatusText = section === "artist" ? getArtistSourceStatus(HUB_STATE.artistSource) : "";
        let message = `${sectionDef.label} data is loading.`;
        if (HUB_STATE.viewMode === "favorites") {
            message = "No favorites yet.";
        } else if (HUB_STATE.viewMode === "selected") {
            message = "No selected cards yet.";
        } else if (section === "composition" || section === "expression" || section === "lighting") {
            message = `${sectionDef.label} is empty for now.`;
        }
        if (HUB_STATE.viewMode === "all" && section === "artist" && HUB_STATE.artistDataLoading) {
            message = sourceStatusText || "Artist data is loading.";
        } else if (HUB_STATE.viewMode === "all" && section === "artist" && sourceStatusText.startsWith("Failed")) {
            message = `Artist source load failed. ${sourceStatusText}`;
        } else if (HUB_STATE.viewMode === "all" && section === "artist" && sourceStatusText) {
            message = sourceStatusText;
        } else if (HUB_STATE.viewMode === "all" && section === "character" && HUB_STATE.characterDataLoading) {
            message = getCharacterSourceStatus(HUB_STATE.characterSource) || "人物资料正在载入。";
        } else if (HUB_STATE.viewMode === "all" && section === "character" && getCharacterSourceStatus(HUB_STATE.characterSource).startsWith("载入失败")) {
            message = `人物来源载入失败。${getCharacterSourceStatus(HUB_STATE.characterSource)}`;
        }
        grid.appendChild(createEl("div", "anima-hub-empty", message));
    } else if (!taxonomyFiltered.length) {
        grid.appendChild(createEl("div", "anima-hub-empty", "No items in this subcategory."));
    } else if (!filtered.length) {
        grid.appendChild(createEl("div", "anima-hub-empty", "No matching items."));
    } else {
        filtered.forEach(item => {
            const key = getItemKey(section, item);
            const card = createEl("div", "anima-hub-card");
            card.classList.toggle("selected", selectedMap.has(key));
            card.classList.toggle("flipping", (HUB_STATE.imageFlipUntil[key] || 0) > Date.now());
            card.onclick = event => {
                if (shouldIgnoreCardToggle(event)) return;
                toggleCardSelection(root, section, item, "trigger");
            };

            const thumb = createEl("div", "anima-hub-thumb", "No image");
            const imageUrls = getItemImageUrls(section, item);
            const variantIndex = Math.min(HUB_STATE.imageVariants[key] || 0, Math.max(imageUrls.length - 1, 0));
            const imageUrl = imageUrls[variantIndex] || "";
            if (imageUrls.length) {
                thumb.textContent = "";
                const bg = createEl("div", "anima-hub-thumb-bg");
                bg.style.backgroundImage = `url("${imageUrl.replaceAll('"', "%22")}")`;
                thumb.appendChild(bg);

                const imageWrap = createEl("div", "anima-hub-thumb-image-wrap");
                const img = document.createElement("img");
                img.loading = "lazy";
                img.src = imageUrl;
                img.alt = `${getItemTitle(section, item)} ${variantIndex + 1}`;
                img.onerror = () => {
                    img.remove();
                    bg.remove();
                    thumb.textContent = "No image";
                };
                imageWrap.appendChild(img);
                thumb.appendChild(imageWrap);
            }
            thumb.appendChild(createCardOverlay(root, section, item, imageUrl, imageUrls, variantIndex));

            thumb.appendChild(createCardCaption(root, section, item));

            card.appendChild(thumb);
            grid.appendChild(card);
        });
        if (filtered.length < matching.length) {
            grid.appendChild(createEl("div", "anima-hub-load-more", `Scroll to load more (${filtered.length} / ${matching.length})`));
        }
    }

    const count = root.querySelector(".anima-hub-count");
    if (count) {
        const sourceLabel = HUB_STATE.viewMode === "favorites" ? "favorites" : "total";
        count.textContent = `${selectedMap.size} selected / ${allData.length} ${sourceLabel} / showing ${filtered.length}`;
    }
    requestAnimationFrame(() => {
        grid.scrollTop = previousScrollTop;
    });
}

async function handleGridScroll(root) {
    const grid = root.querySelector(".anima-hub-grid");
    const section = HUB_STATE.activeSection;
    if (!grid || grid.dataset.section !== section) return;
    const total = Number(grid.dataset.matchingTotal || "0");
    const current = HUB_STATE.visibleLimits[section] || PAGE_SIZE;
    const nearBottom = grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 360;
    if (!nearBottom) return;
    if (current >= total) {
        if (section === "character") {
            await loadMoreCharacterData(root);
        }
        return;
    }
    HUB_STATE.visibleLimits[section] = current + PAGE_SIZE;
    renderHub(root);
}

function switchSection(root, section) {
    HUB_STATE.activeSection = section;
    const search = root.querySelector(".anima-hub-search");
    if (search) search.value = HUB_STATE.searchQueries[section] || "";
    renderHub(root);
}

function resetHubSearchQueries() {
    SECTIONS.forEach(section => {
        HUB_STATE.searchQueries[section.id] = "";
    });
}

function closeHub() {
    if (activeHub) {
        resetHubSearchQueries();
        resetAllVisibleLimits();
    }
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
    loadHubEdits();
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

    const body = createEl("div", "anima-hub-body");
    const sidebar = createEl("div", "anima-hub-sidebar");
    const main = createEl("div", "anima-hub-main");

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
    search.value = HUB_STATE.searchQueries[HUB_STATE.activeSection] || "";
    search.oninput = () => {
        HUB_STATE.searchQueries[HUB_STATE.activeSection] = search.value;
        resetVisibleLimit(HUB_STATE.activeSection);
        renderHub(root);
    };

    const sourceSelect = createEl("select", "anima-hub-artist-source");
    sourceSelect.onchange = () => {
        if (HUB_STATE.activeSection === "artist") {
            HUB_STATE.artistSource = sourceSelect.value;
            setActiveArtistSource(HUB_STATE.artistSource);
            HUB_STATE.artistDataLoadedSource = "";
            HUB_STATE.artistData = [];
            resetVisibleLimit("artist");
        } else if (HUB_STATE.activeSection === "character") {
            HUB_STATE.characterSource = sourceSelect.value;
            setActiveCharacterSource(HUB_STATE.characterSource);
            HUB_STATE.characterDataLoadedSource = "";
            HUB_STATE.characterData = [];
            resetVisibleLimit("character");
        }
        renderHub(root);
    };

    const sourceStatus = createEl("div", "anima-hub-source-status", "");

    const view = createEl("div", "anima-hub-view");
    const allView = createEl("button", "anima-hub-pill", "All");
    allView.type = "button";
    allView.dataset.view = "all";
    allView.onclick = () => {
        HUB_STATE.viewMode = "all";
        resetVisibleLimit(HUB_STATE.activeSection);
        renderHub(root);
    };
    const favoritesView = createEl("button", "anima-hub-pill", "Favorites");
    favoritesView.type = "button";
    favoritesView.dataset.view = "favorites";
    favoritesView.onclick = () => {
        HUB_STATE.viewMode = "favorites";
        resetVisibleLimit(HUB_STATE.activeSection);
        renderHub(root);
    };
    const selectedView = createEl("button", "anima-hub-pill", "Selected 0");
    selectedView.type = "button";
    selectedView.dataset.view = "selected";
    selectedView.onclick = () => {
        HUB_STATE.viewMode = "selected";
        resetVisibleLimit(HUB_STATE.activeSection);
        renderHub(root);
    };
    view.appendChild(allView);
    view.appendChild(favoritesView);
    view.appendChild(selectedView);

    const customTools = createEl("div", "anima-hub-custom-tools");
    const addCategory = createEl("button", "anima-hub-pill", "新增小分类");
    addCategory.type = "button";
    addCategory.onclick = () => openCustomCategoryDialog(root);
    const addCard = createEl("button", "anima-hub-pill", "新增卡片");
    addCard.type = "button";
    addCard.onclick = () => openCustomCardDialog(root);
    customTools.appendChild(addCategory);
    customTools.appendChild(addCard);

    const target = createEl("select", "anima-hub-target");
    target.onchange = () => {
        HUB_STATE.targetIds[HUB_STATE.activeSection] = target.value;
    };
    toolbar.appendChild(view);
    toolbar.appendChild(customTools);
    toolbar.appendChild(sourceSelect);
    toolbar.appendChild(sourceStatus);
    toolbar.appendChild(search);
    toolbar.appendChild(target);

    const taxonomy = createEl("div", "anima-hub-taxonomy hidden");
    const grid = createEl("div", "anima-hub-grid");
    grid.onscroll = () => handleGridScroll(root);

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
    sidebar.appendChild(tabs);
    sidebar.appendChild(taxonomy);
    main.appendChild(toolbar);
    main.appendChild(grid);
    body.appendChild(sidebar);
    body.appendChild(main);
    root.appendChild(body);
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
    Promise.all([loadFavoritesConfig(), loadCustomHubData()]).then(() => renderHub(root));
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
