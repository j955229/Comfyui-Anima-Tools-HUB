import { getTaxonomyGroups } from "./anima_taxonomy.js";

export const SELECTOR_RANDOM_SCOPE_PROPERTY = "anima_selector_random_scope";

let activePopover = null;

const SECTION_LABELS = {
    artist: "画师",
    character: "人物",
    clothing: "服装",
    background: "背景",
    pose: "姿势",
    composition: "构图",
    expression: "表情",
    lighting: "光线",
};

function stopEvent(event) {
    event.stopPropagation();
}

function getRandomScopeState(node) {
    node.properties = node.properties || {};
    const state = node.properties[SELECTOR_RANDOM_SCOPE_PROPERTY];
    if (state && typeof state === "object" && !Array.isArray(state)) {
        return state;
    }
    node.properties[SELECTOR_RANDOM_SCOPE_PROPERTY] = {};
    return node.properties[SELECTOR_RANDOM_SCOPE_PROPERTY];
}

function normalizeScopeIds(ids) {
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids.map(id => String(id || "").trim()).filter(id => id && id !== "all"))];
}

export function getRandomScopeIds(node, section) {
    const value = getRandomScopeState(node)[section];
    if (Array.isArray(value)) return normalizeScopeIds(value);
    if (value && typeof value === "object") return normalizeScopeIds(value.ids);
    return [];
}

export function setRandomScopeIds(node, section, ids) {
    const state = getRandomScopeState(node);
    const normalized = normalizeScopeIds(ids);
    if (normalized.length) {
        state[section] = normalized;
    } else {
        delete state[section];
    }
    refreshNode(node);
}

export function randomScopeSummary(node, section) {
    const count = getRandomScopeIds(node, section).length;
    return count ? `范围 ${count}` : "范围 全部";
}

export function styleScopeButton(button, node, section) {
    button.textContent = randomScopeSummary(node, section);
    button.title = "选择这个随机开关可抽取的子分类范围";
}

async function loadCustomHubData() {
    try {
        const response = await fetch("/anima-tools/custom-hub");
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

async function getScopeGroups(section) {
    const staticGroups = getTaxonomyGroups(section).map(group => ({
        id: group.id,
        label: group.label,
        children: (group.children || []).map(category => ({
            id: category.id,
            label: category.label,
            groupLabel: group.label,
            isCustom: false,
        })),
    })).filter(group => group.children.length);

    const data = await loadCustomHubData();
    const customCategories = data?.categories?.[section];
    if (Array.isArray(customCategories) && customCategories.length) {
        staticGroups.push({
            id: "custom",
            label: "自定义",
            children: customCategories
                .map(category => ({
                    id: category.id,
                    label: category.label || category.name || "Custom",
                    groupLabel: "自定义",
                    isCustom: true,
                }))
                .filter(category => category.id),
        });
    }

    return staticGroups;
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function scopeButtonStyle(primary = false) {
    return `
        min-height: 28px;
        border-radius: 7px;
        border: 1px solid ${primary ? "rgba(56,189,248,0.52)" : "rgba(255,255,255,0.14)"};
        background: ${primary ? "rgba(14,165,233,0.22)" : "rgba(255,255,255,0.055)"};
        color: ${primary ? "#f0f9ff" : "#d4d4d8"};
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
    `;
}

function positionPopover(panel, anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = 340;
    const margin = 10;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const below = rect.bottom + 8;
    const top = below + 430 < window.innerHeight
        ? below
        : Math.max(margin, rect.top - 430);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${width}px`;
}

function closeActivePopover() {
    if (!activePopover) return;
    activePopover.cleanup?.();
    activePopover.panel?.remove();
    activePopover = null;
}

export async function openRandomScopePopover(anchor, node, section, label, onChange) {
    closeActivePopover();
    const groups = await getScopeGroups(section);
    const validIds = new Set(groups.flatMap(group => group.children.map(category => category.id)));
    const selectedIds = new Set(getRandomScopeIds(node, section).filter(id => validIds.has(id)));
    const panel = createEl("div", "anima-random-scope-popover");
    panel.style.cssText = `
        position: fixed;
        z-index: 100000;
        max-height: min(430px, calc(100vh - 20px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 10px;
        border: 1px solid rgba(148,163,184,0.28);
        background: rgba(17,24,39,0.98);
        box-shadow: 0 18px 48px rgba(0,0,0,0.44);
        color: #e5e7eb;
        pointer-events: auto;
    `;
    panel.addEventListener("pointerdown", stopEvent);
    panel.addEventListener("mousedown", stopEvent);
    panel.addEventListener("click", stopEvent);

    const header = createEl("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 12px 8px;";
    const titleWrap = createEl("div");
    titleWrap.appendChild(createEl("div", "", `随机范围：${label || SECTION_LABELS[section] || section}`));
    titleWrap.firstChild.style.cssText = "font-size:13px;font-weight:900;color:#f8fafc;";
    const hint = createEl("div", "", "选择 0 项时使用全部");
    hint.style.cssText = "margin-top:3px;font-size:11px;color:#94a3b8;";
    titleWrap.appendChild(hint);
    const close = createEl("button", "", "×");
    close.type = "button";
    close.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: #e5e7eb;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
    `;
    close.onclick = closeActivePopover;
    header.appendChild(titleWrap);
    header.appendChild(close);
    panel.appendChild(header);

    const search = createEl("input");
    search.type = "search";
    search.placeholder = "搜索子分类";
    search.style.cssText = `
        margin: 0 12px 10px;
        height: 32px;
        border-radius: 7px;
        border: 1px solid rgba(148,163,184,0.25);
        background: rgba(15,23,42,0.96);
        color: #e5e7eb;
        padding: 0 10px;
        outline: none;
        font-size: 12px;
    `;
    panel.appendChild(search);

    const list = createEl("div");
    list.style.cssText = "overflow:auto;padding:0 8px 8px;";
    panel.appendChild(list);

    const footer = createEl("div");
    footer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(148,163,184,0.16);
    `;
    const status = createEl("div");
    status.style.cssText = "font-size:12px;color:#a1a1aa;font-weight:700;";
    const buttons = createEl("div");
    buttons.style.cssText = "display:flex;gap:8px;";
    const allButton = createEl("button", "", "全部");
    allButton.type = "button";
    allButton.style.cssText = scopeButtonStyle(false);
    const apply = createEl("button", "", "套用");
    apply.type = "button";
    apply.style.cssText = scopeButtonStyle(true);
    buttons.appendChild(allButton);
    buttons.appendChild(apply);
    footer.appendChild(status);
    footer.appendChild(buttons);
    panel.appendChild(footer);

    function renderList() {
        const query = search.value.trim().toLowerCase();
        list.replaceChildren();
        if (!groups.length) {
            const empty = createEl("div", "", "这个分类目前没有子分类可选。");
            empty.style.cssText = "padding:16px 8px;color:#a1a1aa;font-size:12px;";
            list.appendChild(empty);
        }
        groups.forEach(group => {
            const rows = group.children.filter(category => {
                if (!query) return true;
                return `${group.label} ${category.label}`.toLowerCase().includes(query);
            });
            if (!rows.length) return;
            const groupTitle = createEl("div", "", group.label);
            groupTitle.style.cssText = "padding:8px 4px 5px;color:#94a3b8;font-size:11px;font-weight:900;text-transform:uppercase;";
            list.appendChild(groupTitle);
            rows.forEach(category => {
                const row = createEl("label");
                row.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-height: 30px;
                    padding: 4px 6px;
                    border-radius: 7px;
                    cursor: pointer;
                    color: #e5e7eb;
                    font-size: 12px;
                    font-weight: 750;
                `;
                row.onmouseenter = () => { row.style.background = "rgba(255,255,255,0.06)"; };
                row.onmouseleave = () => { row.style.background = "transparent"; };
                const checkbox = createEl("input");
                checkbox.type = "checkbox";
                checkbox.checked = selectedIds.has(category.id);
                checkbox.style.cssText = "accent-color:#38bdf8;";
                checkbox.onchange = () => {
                    if (checkbox.checked) selectedIds.add(category.id);
                    else selectedIds.delete(category.id);
                    status.textContent = selectedIds.size ? `已选 ${selectedIds.size}` : "全部";
                };
                row.appendChild(checkbox);
                row.appendChild(createEl("span", "", category.label));
                list.appendChild(row);
            });
        });
        status.textContent = selectedIds.size ? `已选 ${selectedIds.size}` : "全部";
    }

    search.oninput = renderList;
    allButton.onclick = () => {
        selectedIds.clear();
        renderList();
    };
    apply.onclick = () => {
        setRandomScopeIds(node, section, Array.from(selectedIds));
        onChange?.();
        closeActivePopover();
    };

    document.body.appendChild(panel);
    positionPopover(panel, anchor);
    renderList();
    search.focus({ preventScroll: true });

    const outside = event => {
        if (!panel.contains(event.target) && event.target !== anchor) closeActivePopover();
    };
    const escape = event => {
        if (event.key === "Escape") closeActivePopover();
    };
    window.addEventListener("resize", closeActivePopover);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    activePopover = {
        panel,
        cleanup: () => {
            window.removeEventListener("resize", closeActivePopover);
            document.removeEventListener("pointerdown", outside, true);
            document.removeEventListener("keydown", escape, true);
        },
    };
}

function refreshNode(node) {
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    window?.app?.graph?.setDirtyCanvas?.(true, true);
}
