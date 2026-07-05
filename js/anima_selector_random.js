import { t } from "./i18n.js";
import { setWidgetValue } from "./anima_apply_tags.js";
import { openRandomScopePopover, randomScopeSummary, styleScopeButton } from "./anima_random_scope.js";

export const SELECTOR_RANDOM_PROPERTY = "anima_selector_random";

function getRandomState(node) {
    node.properties = node.properties || {};
    const state = node.properties[SELECTOR_RANDOM_PROPERTY];
    if (state && typeof state === "object" && !Array.isArray(state)) {
        return state;
    }
    node.properties[SELECTOR_RANDOM_PROPERTY] = {};
    return node.properties[SELECTOR_RANDOM_PROPERTY];
}

function normalizeBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value ?? "").trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes" || text === "on";
}

function isRandomEnabled(node, section) {
    return normalizeBoolean(getRandomState(node)[section]);
}

function setRandomEnabled(node, section, enabled) {
    const state = getRandomState(node);
    state[section] = Boolean(enabled);
    refreshNode(node);
}

function refreshNode(node) {
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    window?.app?.graph?.setDirtyCanvas?.(true, true);
}

function refreshSelectorActionRows(node) {
    const rows = node?._animaSelectorActionRows;
    if (!rows || typeof rows !== "object") return;
    Object.values(rows).forEach(row => row?.__animaSelectorRefresh?.());
}

function extractSelectorTagsPayload(message) {
    const candidates = [
        message?.anima_selector_tags,
        message?.output?.anima_selector_tags,
        message?.ui?.anima_selector_tags,
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate[0] && typeof candidate[0] === "object") {
            return candidate[0];
        }
        if (candidate && typeof candidate === "object") {
            return candidate;
        }
    }
    return null;
}

function syncSelectorTagsFromExecution(node, message) {
    const payload = extractSelectorTagsPayload(message);
    if (!payload) return;
    for (const [name, value] of Object.entries(payload)) {
        setWidgetValue(node, name, value);
    }
    refreshNode(node);
}

export function installSelectorExecutionSync(nodeType) {
    if (!nodeType?.prototype || nodeType.prototype.__animaSelectorExecutionSyncInstalled) return;
    nodeType.prototype.__animaSelectorExecutionSyncInstalled = true;

    const origOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
        const result = origOnConfigure?.apply(this, arguments);
        setTimeout(() => {
            refreshSelectorActionRows(this);
            refreshNode(this);
        }, 0);
        return result;
    };

    const origOnExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
        const result = origOnExecuted?.apply(this, arguments);
        syncSelectorTagsFromExecution(this, message);
        refreshSelectorActionRows(this);
        return result;
    };
}

function stopNodeDrag(event) {
    event.preventDefault();
    event.stopPropagation();
}

function baseButtonStyle() {
    return `
        height: 28px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,0.12);
        color: #e5e7eb;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        pointer-events: auto;
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    `;
}

function styleToggle(button, enabled) {
    button.textContent = enabled ? t("Random On") : t("Random Off");
    button.title = t("Auto randomize this selector when the workflow runs.");
    button.style.cssText = `
        ${baseButtonStyle()}
        flex: 0 0 92px;
        background: ${enabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.045)"};
        border-color: ${enabled ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.10)"};
        color: ${enabled ? "#f3f4f6" : "#9ca3af"};
        box-shadow: none;
    `;
}

function styleRangeButton(button, node, section) {
    styleScopeButton(button, node, section);
    button.style.cssText = `
        ${baseButtonStyle()}
        flex: 0 0 74px;
        background: rgba(255,255,255,0.04);
        border-color: rgba(255,255,255,0.10);
        color: ${randomScopeSummary(node, section) === "范围 全部" ? "#a1a1aa" : "#bae6fd"};
        box-shadow: none;
    `;
}

export function addSelectorActionRow(node, config) {
    const {
        section,
        label,
        onOpen,
    } = config || {};

    if (!node || !section || typeof onOpen !== "function") return null;
    node._animaSelectorActionRows = node._animaSelectorActionRows || {};
    const existingRow = node._animaSelectorActionRows[section];
    if (existingRow && node.widgets?.includes(existingRow)) {
        existingRow.__animaSelectorRefresh?.();
        return existingRow;
    }
    if (existingRow) {
        delete node._animaSelectorActionRows[section];
    }

    if (typeof node.addDOMWidget !== "function") {
        const openWidget = node.addWidget("button", label, null, onOpen);
        const toggleWidget = node.addWidget("button", isRandomEnabled(node, section) ? t("Random On") : t("Random Off"), null, () => {
            setRandomEnabled(node, section, !isRandomEnabled(node, section));
            toggleWidget.__animaSelectorRefresh?.();
        });
        toggleWidget.__animaSelectorActionSection = section;
        toggleWidget.__animaSelectorRefresh = () => {
            toggleWidget.name = isRandomEnabled(node, section) ? t("Random On") : t("Random Off");
        };
        toggleWidget.__animaSelectorRefresh();
        node._animaSelectorActionRows[section] = toggleWidget;
        return toggleWidget;
    }

    const row = document.createElement("div");
    row.className = "anima-selector-action-row";
    row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        height: 30px;
        box-sizing: border-box;
        padding: 1px 0;
        pointer-events: none;
    `;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = label;
    openButton.style.cssText = `
        ${baseButtonStyle()}
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: rgba(255,255,255,0.055);
        border-color: rgba(255,255,255,0.12);
        color: #e5e7eb;
    `;
    openButton.onmouseenter = () => {
        openButton.style.boxShadow = "none";
        openButton.style.borderColor = "rgba(255,255,255,0.22)";
        openButton.style.background = "rgba(255,255,255,0.09)";
    };
    openButton.onmouseleave = () => {
        openButton.style.boxShadow = "none";
        openButton.style.borderColor = "rgba(255,255,255,0.12)";
        openButton.style.background = "rgba(255,255,255,0.055)";
    };
    openButton.addEventListener("pointerdown", stopNodeDrag);
    openButton.addEventListener("mousedown", stopNodeDrag);
    openButton.addEventListener("click", async event => {
        stopNodeDrag(event);
        await onOpen();
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    const updateToggle = () => styleToggle(toggleButton, isRandomEnabled(node, section));
    updateToggle();
    toggleButton.addEventListener("pointerdown", stopNodeDrag);
    toggleButton.addEventListener("mousedown", stopNodeDrag);
    toggleButton.addEventListener("click", event => {
        stopNodeDrag(event);
        setRandomEnabled(node, section, !isRandomEnabled(node, section));
        updateToggle();
    });

    const rangeButton = document.createElement("button");
    rangeButton.type = "button";
    const updateRange = () => styleRangeButton(rangeButton, node, section);
    updateRange();
    rangeButton.addEventListener("pointerdown", stopNodeDrag);
    rangeButton.addEventListener("mousedown", stopNodeDrag);
    rangeButton.addEventListener("click", event => {
        stopNodeDrag(event);
        openRandomScopePopover(rangeButton, node, section, "", () => {
            updateRange();
            refreshNode(node);
        });
    });

    row.appendChild(openButton);
    row.appendChild(toggleButton);
    row.appendChild(rangeButton);

    const widget = node.addDOMWidget(`anima_${section}_selector_actions`, "div", row, {
        serialize: false,
        hideOnZoom: false,
        getValue: () => "",
        setValue: () => {},
    });
    widget.__animaSelectorActionSection = section;
    widget.__animaSelectorRefresh = () => {
        updateToggle();
        updateRange();
    };
    widget.serialize = false;
    widget.computeSize = (width) => [width, 32];
    widget.computedHeight = 32;

    node._animaSelectorActionRows[section] = widget;
    return widget;
}
