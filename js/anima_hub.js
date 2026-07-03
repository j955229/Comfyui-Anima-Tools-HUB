import { app } from "../../scripts/app.js";
import { applyTagsToTarget } from "./anima_apply_tags.js";
import { ANIMA_SECTION_WIDGETS, getTargetById, resolveAnimaTargets } from "./anima_target_resolver.js";
import "./data.js";
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
    characterMode: "trigger",
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
    if (section === "artist") return window.galleryData || [];
    if (section === "character") return window.characterData || [];
    if (section === "clothing") return window.clothingData || [];
    if (section === "background") return window.backgroundData || [];
    if (section === "pose") return window.poseData || [];
    return [];
}

function getItemKey(section, item) {
    if (item?.hubKey) return String(item.hubKey);
    if (section === "artist") return String(item?.name || "");
    return String(item?.id || item?.name || item?.tags || "");
}

function getItemTitle(section, item) {
    if (section === "artist") return `@${item?.name || ""}`;
    if (section === "character") return titleCase(item?.name || "");
    return item?.name || item?.name_zh || item?.tags || "";
}

function getItemMeta(section, item) {
    if (section === "artist") return `${item?.post_count ?? 0} works`;
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

async function getPromptForItem(section, item, characterMode = HUB_STATE.characterMode) {
    if (section === "artist") return `@${item?.name || ""}`;
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
        .anima-hub-character-mode {
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
        .anima-hub-character-mode {
            width: 155px;
        }
        .anima-hub-view {
            display: flex;
            gap: 8px;
        }
        .anima-hub-grid {
            padding: 16px 18px;
            overflow: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 12px;
            align-content: start;
        }
        .anima-hub-card {
            min-height: 280px;
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
            object-fit: cover;
            display: block;
        }
        .anima-hub-card-title {
            font-size: 13px;
            font-weight: 800;
            line-height: 1.35;
            overflow-wrap: anywhere;
            min-height: 18px;
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
            grid-template-columns: 1fr 1fr 38px;
            gap: 7px;
            margin-top: auto;
        }
        .anima-hub-card-action {
            height: 30px;
            padding: 0 8px;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .anima-hub-empty {
            grid-column: 1 / -1;
            color: #a1a1aa;
            padding: 24px 0;
        }
        @media (max-width: 760px) {
            .anima-hub-toolbar,
            .anima-hub-footer {
                flex-wrap: wrap;
            }
            .anima-hub-target,
            .anima-hub-character-mode {
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

function renderHub(root) {
    const section = HUB_STATE.activeSection;
    const sectionDef = SECTIONS.find(item => item.id === section) || SECTIONS[0];
    const query = root.querySelector(".anima-hub-search")?.value?.trim?.().toLowerCase() || "";
    const targets = resolveAnimaTargets(section, HUB_STATE.preferredNode);
    const targetSelect = root.querySelector(".anima-hub-target");
    const characterMode = root.querySelector(".anima-hub-character-mode");

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

    if (characterMode) {
        characterMode.style.display = section === "character" ? "" : "none";
        characterMode.value = HUB_STATE.characterMode;
    }

    root.querySelectorAll(".anima-hub-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.section === section);
    });
    renderViewButtons(root);

    const allData = getVisibleData(section);
    const selectedMap = HUB_STATE.selected[section];
    const favoriteMap = getFavoritesMap(section);
    const filtered = allData.filter(item => !query || getSearchText(section, item).includes(query)).slice(0, 240);

    const grid = root.querySelector(".anima-hub-grid");
    grid.innerHTML = "";
    if (!allData.length) {
        const message = HUB_STATE.viewMode === "favorites" ? "No favorites yet." : `${sectionDef.label} data is loading.`;
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
                img.onerror = () => {
                    img.remove();
                    thumb.textContent = "No image";
                };
                thumb.appendChild(img);
            }

            const title = createEl("div", "anima-hub-card-title", getItemTitle(section, item));
            const meta = createEl("div", "anima-hub-card-meta", getItemMeta(section, item) || item?.tags || "");

            const actions = createEl("div", "anima-hub-card-actions");
            const select = createEl("button", selectedMap.has(key) ? "anima-hub-card-action primary" : "anima-hub-card-action", selectedMap.has(key) ? "Selected" : "Select");
            select.type = "button";
            select.onclick = () => {
                if (selectedMap.has(key)) {
                    selectedMap.delete(key);
                } else {
                    selectedMap.set(key, item);
                }
                renderHub(root);
            };

            const copy = createEl("button", "anima-hub-card-action", "Copy");
            copy.type = "button";
            copy.onclick = async () => {
                const prompt = await getPromptForItem(section, item);
                await copyText(prompt ? `${prompt}, ` : "");
            };

            const favorite = createEl("button", favoriteMap.has(key) ? "anima-hub-card-action primary" : "anima-hub-card-action", favoriteMap.has(key) ? "*" : "+");
            favorite.type = "button";
            favorite.title = favoriteMap.has(key) ? "Remove favorite" : "Add favorite";
            favorite.onclick = async () => {
                favorite.disabled = true;
                await toggleFavorite(section, item);
                renderHub(root);
            };

            actions.appendChild(select);
            actions.appendChild(copy);
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

    const characterMode = createEl("select", "anima-hub-character-mode");
    characterMode.innerHTML = `
        <option value="trigger">Trigger</option>
        <option value="trigger_tags">Trigger + Tags</option>
    `;
    characterMode.onchange = () => {
        HUB_STATE.characterMode = characterMode.value;
        renderHub(root);
    };

    const target = createEl("select", "anima-hub-target");
    target.onchange = () => {
        HUB_STATE.targetIds[HUB_STATE.activeSection] = target.value;
    };
    toolbar.appendChild(view);
    toolbar.appendChild(search);
    toolbar.appendChild(characterMode);
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
