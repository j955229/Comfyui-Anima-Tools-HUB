import { app } from "../../scripts/app.js";
import { SELECTOR_RANDOM_PROPERTY } from "./anima_selector_random.js";
import { openAnimaHub } from "./anima_hub.js";
import { openRandomScopePopover, randomScopeSummary, styleScopeButton } from "./anima_random_scope.js";

const PROMPT_NODE_CONFIGS = {
    AnimaCharacterSpec: {
        openSection: "character",
        toggles: [
            ["character", "角色名"],
            ["clothing", "服装"],
            ["expression", "表情"],
            ["pose", "姿势"],
        ],
    },
    AnimaSceneCollector: {
        openSection: "background",
        toggles: [
            ["background", "背景"],
            ["lighting", "光线"],
            ["composition", "构图"],
        ],
    },
    AnimaFinalAssembler: {
        openSection: "artist",
        toggles: [
            ["artist", "画师"],
        ],
    },
};

app.registerExtension({
    name: "AnimaPromptBuilder.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        const config = PROMPT_NODE_CONFIGS[nodeData.name];
        const isFinalAssembler = nodeData.name === "AnimaFinalAssembler";
        if (!config && !isFinalAssembler) return;

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            if (config) addPromptBuilderActionPanel(this, config);
            if (isFinalAssembler) updateCharacterInputs(this);
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = origOnConfigure?.apply(this, arguments);
            setTimeout(() => {
                if (config) addPromptBuilderActionPanel(this, config);
                if (isFinalAssembler) updateCharacterInputs(this);
            }, 0);
            return result;
        };

        if (isFinalAssembler) {
            const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (type, index, connected, linkInfo, inputInfo) {
                const result = origOnConnectionsChange?.apply(this, arguments);
                if (type === 1) updateCharacterInputs(this);
                return result;
            };
        }
    },
});

function updateCharacterInputs(node) {
    if (!node?.inputs) return;
    let changed = false;
    let characterInputs = getCharacterInputs(node);
    if (!characterInputs.length) return;

    const lastInput = characterInputs[characterInputs.length - 1];
    if (lastInput?.link !== null && lastInput?.link !== undefined) {
        const lastNumber = getCharacterInputNumber(lastInput, characterInputs.length);
        node.addInput(`character${lastNumber + 1}`, "CHARACTER_PROMPT");
        changed = true;
    }

    characterInputs = getCharacterInputs(node);
    for (let i = characterInputs.length - 1; i > 0; i--) {
        const current = characterInputs[i];
        const previous = characterInputs[i - 1];
        if ((current.link === null || current.link === undefined) && (previous.link === null || previous.link === undefined)) {
            node.removeInput(node.inputs.indexOf(current));
            changed = true;
        }
    }

    if (changed) {
        refreshNode(node);
        node.setSize?.(node.computeSize?.() || node.size);
    }
}

function getCharacterInputs(node) {
    return (node.inputs || []).filter(input => input?.name && /^character\d+$/.test(input.name));
}

function getCharacterInputNumber(input, fallback) {
    const match = String(input?.name || "").match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : fallback;
}

function getRandomState(node) {
    node.properties = node.properties || {};
    const state = node.properties[SELECTOR_RANDOM_PROPERTY];
    if (state && typeof state === "object" && !Array.isArray(state)) {
        return state;
    }
    node.properties[SELECTOR_RANDOM_PROPERTY] = {};
    return node.properties[SELECTOR_RANDOM_PROPERTY];
}

function isRandomEnabled(node, section) {
    return Boolean(getRandomState(node)[section]);
}

function setRandomEnabled(node, section, enabled) {
    getRandomState(node)[section] = Boolean(enabled);
    refreshNode(node);
    node._animaPromptBuilderPanelWidget?.__animaPromptBuilderRefresh?.();
}

function refreshNode(node) {
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    app?.graph?.setDirtyCanvas?.(true, true);
}

function stopNodeDrag(event) {
    event.preventDefault();
    event.stopPropagation();
}

function createButton(label, onClick, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = `
        min-height: 28px;
        border-radius: 7px;
        border: 1px solid ${primary ? "rgba(56,189,248,0.48)" : "rgba(255,255,255,0.12)"};
        background: ${primary ? "rgba(14,165,233,0.22)" : "rgba(255,255,255,0.055)"};
        color: ${primary ? "#f0f9ff" : "#e5e7eb"};
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        pointer-events: auto;
    `;
    button.addEventListener("pointerdown", stopNodeDrag);
    button.addEventListener("mousedown", stopNodeDrag);
    button.addEventListener("click", event => {
        stopNodeDrag(event);
        onClick?.();
    });
    return button;
}

function styleToggleButton(button, node, section, label) {
    const enabled = isRandomEnabled(node, section);
    button.textContent = `${label}: ${enabled ? "随机开" : "随机关"}`;
    button.style.background = enabled ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.045)";
    button.style.borderColor = enabled ? "rgba(56,189,248,0.40)" : "rgba(255,255,255,0.10)";
    button.style.color = enabled ? "#e0f2fe" : "#a1a1aa";
}

function styleRangeButton(button, node, section) {
    styleScopeButton(button, node, section);
    button.style.minHeight = "28px";
    button.style.borderRadius = "7px";
    button.style.border = "1px solid rgba(255,255,255,0.10)";
    button.style.background = "rgba(255,255,255,0.04)";
    button.style.color = randomScopeSummary(node, section) === "范围 全部" ? "#a1a1aa" : "#bae6fd";
    button.style.fontSize = "12px";
    button.style.fontWeight = "800";
    button.style.cursor = "pointer";
    button.style.pointerEvents = "auto";
}

function addPromptBuilderActionPanel(node, config) {
    if (!node || !config) return null;
    const existing = node._animaPromptBuilderPanelWidget;
    if (existing && node.widgets?.includes(existing)) {
        existing.__animaPromptBuilderRefresh?.();
        return existing;
    }

    if (typeof node.addDOMWidget !== "function") {
        let firstWidget = null;
        config.toggles.forEach(([section, label]) => {
            const toggle = node.addWidget("button", `${label}: ${isRandomEnabled(node, section) ? "随机开" : "随机关"}`, null, () => {
                setRandomEnabled(node, section, !isRandomEnabled(node, section));
                toggle.name = `${label}: ${isRandomEnabled(node, section) ? "随机开" : "随机关"}`;
            });
            firstWidget = firstWidget || toggle;
            toggle.__animaPromptBuilderActionSection = section;
        });
        node.addWidget("button", "打开 Anima Prompt Hub", null, () => openAnimaHub(config.openSection, node));
        node._animaPromptBuilderPanelWidget = firstWidget;
        return firstWidget;
    }

    const panel = document.createElement("div");
    panel.className = "anima-prompt-builder-actions";
    panel.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        padding: 4px 0 2px;
        pointer-events: none;
    `;

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;";
    const toggleButtons = [];
    const rangeButtons = [];
    config.toggles.forEach(([section, label]) => {
        const cell = document.createElement("div");
        cell.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:5px;min-width:0;";
        const toggle = createButton("", () => {
            setRandomEnabled(node, section, !isRandomEnabled(node, section));
            styleToggleButton(toggle, node, section, label);
        });
        styleToggleButton(toggle, node, section, label);
        toggleButtons.push([toggle, section, label]);
        const range = createButton("", () => {
            openRandomScopePopover(range, node, section, label, () => {
                styleRangeButton(range, node, section);
                refreshNode(node);
            });
        });
        styleRangeButton(range, node, section);
        rangeButtons.push([range, section]);
        cell.appendChild(toggle);
        cell.appendChild(range);
        grid.appendChild(cell);
    });
    if (config.toggles.length % 2 === 0) {
        const spacer = document.createElement("div");
        spacer.setAttribute("aria-hidden", "true");
        grid.appendChild(spacer);
    }
    grid.appendChild(createButton("打开 Anima Prompt Hub", () => openAnimaHub(config.openSection, node), true));
    panel.appendChild(grid);

    const rowCount = Math.ceil((config.toggles.length + (config.toggles.length % 2 === 0 ? 2 : 1)) / 2);
    const widget = node.addDOMWidget("anima_prompt_builder_actions", "div", panel, {
        serialize: false,
        hideOnZoom: false,
        getValue: () => "",
        setValue: () => {},
    });
    widget.serialize = false;
    widget.computeSize = (width) => [width, 10 + rowCount * 34];
    widget.computedHeight = 10 + rowCount * 34;
    widget.__animaPromptBuilderRefresh = () => {
        toggleButtons.forEach(([button, section, label]) => styleToggleButton(button, node, section, label));
        rangeButtons.forEach(([button, section]) => styleRangeButton(button, node, section));
    };
    node._animaPromptBuilderPanelWidget = widget;
    return widget;
}
