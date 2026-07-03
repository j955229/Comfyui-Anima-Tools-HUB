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

const HUB_STATE = {
    activeSection: "artist",
    preferredNode: null,
    selected: {
        artist: new Map(),
        character: new Map(),
        clothing: new Map(),
        background: new Map(),
        pose: new Map(),
    },
    targetIds: {},
};

let activeHub = null;

function splitPromptTokens(value) {
    return String(value || "")
        .split(",")
        .map(part => part.replace(/^_raw_:/, "").trim())
        .filter(Boolean);
}

function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
}

function titleCase(value) {
    return String(value || "")
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
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

function getPromptForItem(section, item) {
    if (section === "artist") return `@${item?.name || ""}`;
    if (section === "character") {
        const parts = [item?.name, item?.copyright].filter(Boolean);
        return parts.join(", ");
    }
    return splitPromptTokens(item?.tags).join(", ");
}

function formatSelectedPrompt(section) {
    const selected = Array.from(HUB_STATE.selected[section].values());
    const prompt = selected
        .flatMap(item => splitPromptTokens(getPromptForItem(section, item)))
        .filter(Boolean)
        .join(", ");
    return prompt ? `${prompt}, ` : "";
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
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
            height: min(820px, 92vh);
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
        .anima-hub-tab {
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
        .anima-hub-button.primary {
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
        .anima-hub-tab.active {
            background: rgba(56,189,248,0.16);
            border-color: rgba(56,189,248,0.48);
            color: #ffffff;
        }
        .anima-hub-search,
        .anima-hub-target {
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
            width: min(460px, 45vw);
        }
        .anima-hub-grid {
            padding: 16px 18px;
            overflow: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 10px;
            align-content: start;
        }
        .anima-hub-card {
            min-height: 82px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.09);
            background: rgba(255,255,255,0.045);
            padding: 11px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 7px;
            box-sizing: border-box;
        }
        .anima-hub-card.selected {
            border-color: rgba(56,189,248,0.64);
            background: rgba(56,189,248,0.13);
        }
        .anima-hub-card-title {
            font-size: 13px;
            font-weight: 800;
            line-height: 1.35;
            overflow-wrap: anywhere;
        }
        .anima-hub-card-meta,
        .anima-hub-count {
            font-size: 12px;
            line-height: 1.35;
            color: #a1a1aa;
            overflow-wrap: anywhere;
        }
        .anima-hub-empty {
            grid-column: 1 / -1;
            color: #a1a1aa;
            padding: 24px 0;
        }
    `;
    document.head.appendChild(style);
}

function renderHub(root) {
    const section = HUB_STATE.activeSection;
    const sectionDef = SECTIONS.find(item => item.id === section) || SECTIONS[0];
    const query = root.querySelector(".anima-hub-search")?.value?.trim?.().toLowerCase() || "";
    const targets = resolveAnimaTargets(section, HUB_STATE.preferredNode);
    const targetSelect = root.querySelector(".anima-hub-target");

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

    const data = getSectionData(section);
    const selectedMap = HUB_STATE.selected[section];
    const filtered = data.filter(item => {
        if (!query) return true;
        return [
            getItemTitle(section, item),
            getItemMeta(section, item),
            getPromptForItem(section, item),
            item?.name_zh,
            item?.tags_zh,
        ].some(value => String(value || "").toLowerCase().includes(query));
    }).slice(0, 240);

    const grid = root.querySelector(".anima-hub-grid");
    grid.innerHTML = "";
    if (!data.length) {
        grid.appendChild(createEl("div", "anima-hub-empty", `${sectionDef.label} data is loading.`));
    } else if (!filtered.length) {
        grid.appendChild(createEl("div", "anima-hub-empty", "No matching items."));
    } else {
        filtered.forEach(item => {
            const key = getItemKey(section, item);
            const card = createEl("button", "anima-hub-card");
            card.type = "button";
            card.classList.toggle("selected", selectedMap.has(key));

            const title = createEl("div", "anima-hub-card-title", getItemTitle(section, item));
            const meta = createEl("div", "anima-hub-card-meta", getItemMeta(section, item) || getPromptForItem(section, item));
            card.appendChild(title);
            card.appendChild(meta);
            card.onclick = () => {
                if (selectedMap.has(key)) {
                    selectedMap.delete(key);
                } else {
                    selectedMap.set(key, item);
                }
                renderHub(root);
            };
            grid.appendChild(card);
        });
    }

    const count = root.querySelector(".anima-hub-count");
    if (count) {
        count.textContent = `${selectedMap.size} selected / ${data.length} total / showing ${filtered.length}`;
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
    const target = createEl("select", "anima-hub-target");
    target.onchange = () => {
        HUB_STATE.targetIds[HUB_STATE.activeSection] = target.value;
    };
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
    const apply = createEl("button", "anima-hub-button primary", "Apply to Target");
    apply.type = "button";
    apply.onclick = () => {
        const activeSection = HUB_STATE.activeSection;
        const prompt = formatSelectedPrompt(activeSection);
        const targetInfo = getTargetById(activeSection, HUB_STATE.targetIds[activeSection], HUB_STATE.preferredNode);
        if (!targetInfo) {
            alert(`No ${ANIMA_SECTION_WIDGETS[activeSection]} target found.`);
            return;
        }
        if (!applyTagsToTarget(targetInfo, prompt)) {
            alert("Failed to apply tags.");
            return;
        }
    };
    buttonRow.appendChild(clear);
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
