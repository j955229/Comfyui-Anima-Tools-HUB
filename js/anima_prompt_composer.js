import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";

const SECTIONS = ["artist", "character", "clothing"];
const SECTION_META = {
    artist: { color: "#38bdf8", labelKey: "Artists" },
    character: { color: "#f472b6", labelKey: "Characters" },
    clothing: { color: "#a78bfa", labelKey: "Clothing" },
};
const THUMB_W = 60;
const THUMB_H = 80;
const TEXT_PREVIEW_H = 54;

app.registerExtension({
    name: "AnimaPromptComposer.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "AnimaPromptComposer") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            setupComposerNode(this);
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = origOnConfigure?.apply(this, arguments);
            setupComposerNode(this);
            return result;
        };

        const origOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            origOnExecuted?.apply(this, arguments);
            const payload = extractComposerPayload(message);
            if (payload && typeof payload === "object") {
                this._animaComposerLastSelected = payload;
                this._animaComposerHasRun = true;
                updateComposerLayout(this);
            }
        };

        const origOnDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            const result = origOnDrawBackground?.apply(this, arguments);
            drawComposerPreviewOnNode(ctx, this);
            return result;
        };

        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            const result = origOnDrawForeground?.apply(this, arguments);
            drawComposerPreviewOnNode(ctx, this);
            return result;
        };
    }
});

function setupComposerNode(node) {
    if (!node) return;
    node._animaComposerImages = node._animaComposerImages || new Map();
    hideInternalWidgets(node);
    ensureComposerControls(node);
    removePreviewWidget(node);
    updateComposerLayout(node);
    scheduleDomPreviewFallback(node);
}

function ensureComposerControls(node) {
    if (node._animaComposerControlsReady) return;
    node._animaComposerControlsReady = true;

    const toggleBtn = node.addWidget("button", getPreviewToggleLabel(node), null, () => {
        const widget = getWidget(node, "preview_collapsed");
        const current = Boolean(widget?.value);
        setWidgetValue(node, "preview_collapsed", !current);
        toggleBtn.name = getPreviewToggleLabel(node);
        updateComposerLayout(node);
    });
    toggleBtn.__animaComposerToggle = true;
    styleButton(toggleBtn, "#a78bfa", "rgba(167,139,250,0.14)");
}

function updateComposerLayout(node) {
    hideInternalWidgets(node);
    removePreviewWidget(node);
    const toggle = node.widgets?.find(w => w.__animaComposerToggle);
    if (toggle) toggle.name = getPreviewToggleLabel(node);

    const currentWidth = node.size?.[0] || 340;
    const computedSize = node.computeSize ? node.computeSize() : [currentWidth, node.size?.[1] || 120];
    const width = Math.max(340, currentWidth, computedSize[0]);
    const previewHeight = getPreviewHeight(node, width);
    node._animaComposerPreviewHeight = previewHeight;

    updateDomPreviewWidget(node);

    if (node._animaComposerDomPreviewWidget) {
        node._animaComposerNormalHeight = getWidgetBottom(node) || computedSize[1];
        setNodeSize(node, [width, computedSize[1]]);
    } else {
        node._animaComposerNormalHeight = getWidgetBottom(node) || computedSize[1];
        setNodeSize(node, [width, node._animaComposerNormalHeight + previewHeight + 8]);
    }
    refreshCanvas(node);
}

function refreshCanvas(node) {
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
    app.canvas?.setDirtyCanvas?.(true, true);
    app.canvas?.setDirty?.(true, true);
    requestAnimationFrame(() => {
        node.graph?.setDirtyCanvas?.(true, true);
        app.graph?.setDirtyCanvas?.(true, true);
        app.canvas?.setDirtyCanvas?.(true, true);
        app.canvas?.setDirty?.(true, true);
        app.canvas?.draw?.(true, true);
    });
}

function setNodeSize(node, size) {
    if (node.setSize) node.setSize(size);
    else node.size = size;
}

function removePreviewWidget(node) {
    if (!node.widgets) return;
    for (let i = node.widgets.length - 1; i >= 0; i--) {
        if (node.widgets[i]?.__animaComposerPreview || node.widgets[i]?.name === "anima_prompt_composer_preview") {
            node.widgets.splice(i, 1);
        }
    }
}

function scheduleDomPreviewFallback(node) {
    if (node._animaComposerDomFallbackScheduled) return;
    node._animaComposerDomFallbackScheduled = true;
    setTimeout(() => {
        if (node._animaComposerCanvasPreviewDrawnAt) return;
        if (ensureDomPreviewWidget(node)) {
            updateComposerLayout(node);
        }
    }, 300);
}

function ensureDomPreviewWidget(node) {
    if (node._animaComposerDomPreviewWidget) return true;
    if (typeof node.addDOMWidget !== "function") return false;

    const el = document.createElement("div");
    el.className = "anima-composer-dom-preview";
    el.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        color: #e5e7eb;
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
    `;

    const widget = node.addDOMWidget("anima_prompt_composer_dom_preview", "div", el, {
        serialize: false,
        hideOnZoom: false,
        getValue: () => "",
        setValue: () => {},
    });
    widget.__animaComposerDomPreview = true;
    widget.serialize = false;
    widget.computeSize = (width) => [width, getPreviewHeight(node, width)];
    widget.computedHeight = getPreviewHeight(node, node.size?.[0] || 340);

    node._animaComposerDomPreviewWidget = widget;
    node._animaComposerDomPreviewEl = el;
    updateDomPreviewWidget(node);
    return true;
}

function updateDomPreviewWidget(node) {
    const widget = node._animaComposerDomPreviewWidget;
    const el = node._animaComposerDomPreviewEl;
    if (!widget || !el) return;

    const width = Math.max(340, node.size?.[0] || 340);
    const height = getPreviewHeight(node, width);
    widget.computedHeight = height;
    widget.computeSize = (w) => [w, getPreviewHeight(node, w)];
    el.style.minHeight = `${Math.max(1, height - 8)}px`;
    el.innerHTML = "";

    const entries = flattenSelected(node._animaComposerLastSelected);
    const title = document.createElement("div");
    title.style.cssText = `
        padding: 7px 9px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        background: rgba(16,16,24,0.72);
        color: ${entries.length > 0 ? "#fbbf24" : "#9ca3af"};
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    title.textContent = entries.length > 0
        ? `${t("Random Result")} · ${entries.length}`
        : t("Run workflow to preview random result");
    el.appendChild(title);

    if (isPreviewCollapsed(node) || entries.length === 0) return;

    const promptText = buildPromptPreviewText(node);
    const promptPreview = document.createElement("div");
    promptPreview.style.cssText = `
        margin-top: 10px;
        padding: 8px 9px;
        border-radius: 9px;
        background: rgba(0,0,0,0.22);
        border: 1px solid rgba(255,255,255,0.07);
        box-sizing: border-box;
        color: #dbeafe;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        line-height: 1.35;
        height: ${TEXT_PREVIEW_H}px;
        overflow: hidden;
        word-break: break-word;
        cursor: text;
        pointer-events: auto;
        user-select: text;
        -webkit-user-select: text;
    `;
    promptPreview.title = promptText;
    promptPreview.textContent = promptText;
    promptPreview.addEventListener("pointerdown", event => event.stopPropagation());
    promptPreview.addEventListener("mousedown", event => event.stopPropagation());
    promptPreview.addEventListener("click", event => event.stopPropagation());
    el.appendChild(promptPreview);

    const grid = document.createElement("div");
    grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(${THUMB_W}px, 1fr));
        gap: 10px;
        margin-top: 10px;
    `;
    for (const entry of entries) {
        grid.appendChild(createDomThumb(entry));
    }
    el.appendChild(grid);
}

function createDomThumb(entry) {
    const color = SECTION_META[entry.section]?.color || "#38bdf8";
    const wrap = document.createElement("div");
    wrap.style.cssText = "min-width:0;";

    const box = document.createElement("div");
    box.style.cssText = `
        width: ${THUMB_W}px;
        height: ${THUMB_H}px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid ${color};
        background: rgba(255,255,255,0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${color};
        font-size: 20px;
        font-weight: 900;
        box-sizing: border-box;
    `;
    if (entry.preview) {
        const img = document.createElement("img");
        img.src = entry.preview;
        img.loading = "lazy";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
        box.appendChild(img);
    } else {
        box.textContent = (entry.title || "?").slice(0, 1).toUpperCase();
    }

    const label = document.createElement("div");
    label.textContent = t(SECTION_META[entry.section]?.labelKey || "");
    label.style.cssText = `
        margin-top: 4px;
        width: ${THUMB_W}px;
        color: #d1d5db;
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    wrap.appendChild(box);
    wrap.appendChild(label);
    return wrap;
}

function extractComposerPayload(message) {
    const direct = message?.anima_prompt_composer;
    if (Array.isArray(direct)) return direct[0];
    if (direct && typeof direct === "object") return direct;

    const outputDirect = message?.output?.anima_prompt_composer;
    if (Array.isArray(outputDirect)) return outputDirect[0];
    if (outputDirect && typeof outputDirect === "object") return outputDirect;

    const nested = message?.ui?.anima_prompt_composer;
    if (Array.isArray(nested)) return nested[0];
    if (nested && typeof nested === "object") return nested;

    return null;
}

function getWidgetBottom(node) {
    if (!node?.widgets?.length) return 0;
    let bottom = 0;
    for (const widget of node.widgets) {
        if (!widget || widget.name === "preview_collapsed" || widget.__animaComposerPreview) continue;
        const y = Number.isFinite(widget.last_y) ? widget.last_y : widget.y;
        const h = Number.isFinite(widget.computedHeight) ? widget.computedHeight : 24;
        if (Number.isFinite(y) && y > -1000) bottom = Math.max(bottom, y + h);
    }
    return bottom ? bottom + 10 : 0;
}

function hideInternalWidgets(node) {
    const widget = getWidget(node, "preview_collapsed");
    if (!widget) return;
    widget.type = "hidden";
    widget.options = { ...(widget.options || {}), hidden: true };
    widget.serialize = true;
    widget.disabled = true;
    widget.draw = () => {};
    widget.computeSize = () => [0, 0];
    widget.computedHeight = 0;
    widget.y = -100000;
    hideWidgetDom(widget);
}

function hideWidgetDom(widget) {
    [widget?.element, widget?.inputEl, widget?.el, widget?.container].forEach(el => {
        if (!el?.style) return;
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("height", "0px", "important");
        el.style.setProperty("width", "0px", "important");
        el.style.setProperty("position", "absolute", "important");
        el.style.setProperty("left", "-100000px", "important");
    });
}

function styleButton(widget, color, background) {
    if (!widget?.el) return;
    widget.el.style.cssText += `
        border: 1px solid ${color}66 !important;
        background: ${background} !important;
        color: ${color} !important;
        font-weight: 700 !important;
    `;
}

function getWidget(node, name) {
    return node?.widgets?.find(w => w.name === name);
}

function setWidgetValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    widget.value = value;
    if (widget.inputEl) {
        widget.inputEl.value = String(value);
        widget.inputEl.dispatchEvent(new Event("input"));
    }
    widget.callback?.(value);
}

function isPreviewCollapsed(node) {
    return Boolean(getWidget(node, "preview_collapsed")?.value);
}

function getPreviewToggleLabel(node) {
    return isPreviewCollapsed(node) ? t("Expand Preview") : t("Collapse Preview");
}

function getPreviewHeight(node, width = 340) {
    if (isPreviewCollapsed(node)) return 42;
    const entries = flattenSelected(node._animaComposerLastSelected);
    if (entries.length === 0) return 74;
    const columns = Math.max(3, Math.floor((Math.max(320, width) - 36) / (THUMB_W + 16)));
    const rows = Math.ceil(entries.length / columns);
    const rowHeight = THUMB_H + 22;
    const rowGaps = Math.max(0, rows - 1) * 10;
    return Math.min(840, 24 + 42 + TEXT_PREVIEW_H + 12 + rows * rowHeight + rowGaps);
}

function flattenSelected(selected) {
    if (!selected) return [];
    return SECTIONS.flatMap(section => (selected?.[section] || []).map(entry => ({ ...entry, section })));
}

function buildPromptPreviewText(node) {
    const selected = node?._animaComposerLastSelected;
    if (!selected) return "";

    const characterDetail = getWidget(node, "character_detail")?.value || "trigger";
    const parts = [];
    const seen = new Set();

    for (const section of SECTIONS) {
        for (const entry of selected?.[section] || []) {
            for (const part of getEntryPromptParts(entry, section, characterDetail)) {
                const key = part.toLowerCase();
                if (!key || seen.has(key)) continue;
                seen.add(key);
                parts.push(part);
            }
        }
    }

    return parts.length > 0 ? `${parts.join(", ")}, ` : "";
}

function getEntryPromptParts(entry, section, characterDetail) {
    if (section === "character") {
        const parts = splitPromptTokens(entry?.trigger_parts);
        if (characterDetail === "trigger_tags") {
            parts.push(...splitPromptTokens(entry?.tag_parts));
        }
        return parts;
    }
    return splitPromptTokens(entry?.prompt_parts);
}

function splitPromptTokens(value) {
    if (Array.isArray(value)) return value.flatMap(item => splitPromptTokens(item));
    return String(value || "")
        .split(",")
        .map(part => part.replace("_raw_:", "").trim())
        .filter(Boolean);
}

function drawComposerPreviewOnNode(ctx, node) {
    if (!ctx || !node) return;
    node._animaComposerCanvasPreviewDrawnAt = performance.now();
    if (node._animaComposerDomPreviewWidget) return;
    const width = Math.max(340, node.size?.[0] || 340);
    const height = node._animaComposerPreviewHeight || getPreviewHeight(node, width);
    if (height <= 0) return;

    const normalHeight = getWidgetBottom(node) || node._animaComposerNormalHeight || Math.max(0, (node.size?.[1] || height) - height);
    const y = Math.max(0, Math.min(normalHeight, (node.size?.[1] || normalHeight + height) - height));
    drawComposerPreview(ctx, node, width, y, height);
}

function drawComposerPreview(ctx, node, width, y, height) {
    height = height || getPreviewHeight(node, width);
    const x = 10;
    const panelWidth = width - 20;
    const collapsed = isPreviewCollapsed(node);
    const entries = flattenSelected(node._animaComposerLastSelected);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    roundedRect(ctx, x, y + 4, panelWidth, height - 8, 10, "rgba(16,16,24,0.72)", "rgba(255,255,255,0.08)");
    ctx.fillStyle = entries.length > 0 ? "#fbbf24" : "#9ca3af";
    ctx.font = "12px sans-serif";
    const title = entries.length > 0
        ? `${t("Random Result")} · ${entries.length}`
        : t("Run workflow to preview random result");
    ctx.fillText(title, x + 14, y + 25);

    if (collapsed || entries.length === 0) {
        ctx.restore();
        return;
    }

    const promptY = y + 36;
    roundedRect(ctx, x + 14, promptY, panelWidth - 28, TEXT_PREVIEW_H, 8, "rgba(0,0,0,0.22)", "rgba(255,255,255,0.07)");
    ctx.save();
    ctx.beginPath();
    roundedPath(ctx, x + 14, promptY, panelWidth - 28, TEXT_PREVIEW_H, 8);
    ctx.clip();
    ctx.fillStyle = "#dbeafe";
    ctx.font = "11px monospace";
    drawWrappedText(ctx, buildPromptPreviewText(node), x + 22, promptY + 17, panelWidth - 44, 13, 3);
    ctx.restore();

    const columns = Math.max(3, Math.floor((panelWidth - 28) / (THUMB_W + 16)));
    const gridY = promptY + TEXT_PREVIEW_H + 12;
    entries.forEach((entry, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        drawThumb(ctx, node, entry, x + 14 + col * (THUMB_W + 16), gridY + row * (THUMB_H + 32), THUMB_W, THUMB_H);
    });
    ctx.restore();
}

function drawThumb(ctx, node, entry, x, y, width, height) {
    const color = SECTION_META[entry.section]?.color || "#38bdf8";
    roundedRect(ctx, x, y, width, height, 8, "rgba(255,255,255,0.06)", color);
    const img = getPreviewImage(node, entry.preview);
    if (img?.complete && img.naturalWidth > 0) {
        ctx.save();
        roundedClip(ctx, x, y, width, height, 8);
        coverImage(ctx, img, x, y, width, height);
        ctx.restore();
    } else {
        ctx.fillStyle = color;
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText((entry.title || "?").slice(0, 1).toUpperCase(), x + width / 2, y + height / 2 + 7);
        ctx.textAlign = "left";
    }
    ctx.fillStyle = color;
    ctx.fillRect(x, y + height - 4, width, 4);
    ctx.fillStyle = "#d1d5db";
    ctx.font = "10px sans-serif";
    ctx.fillText(t(SECTION_META[entry.section]?.labelKey || ""), x, y + height + 14);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (!value) return;

    let line = "";
    let drawn = 0;
    const words = value.split(" ");

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !line) {
            line = candidate;
            continue;
        }

        ctx.fillText(line, x, y + drawn * lineHeight);
        drawn += 1;
        line = word;

        if (drawn >= maxLines) return;
    }

    if (line && drawn < maxLines) {
        ctx.fillText(line, x, y + drawn * lineHeight);
    }
}

function getPreviewImage(node, url) {
    if (!url) return null;
    if (!node._animaComposerImages) node._animaComposerImages = new Map();
    if (node._animaComposerImages.has(url)) return node._animaComposerImages.get(url);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => node.setDirtyCanvas?.(true, true);
    img.onerror = () => node.setDirtyCanvas?.(true, true);
    img.src = url;
    node._animaComposerImages.set(url, img);
    return img;
}

function roundedRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.save();
    ctx.beginPath();
    roundedPath(ctx, x, y, w, h, r);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function roundedClip(ctx, x, y, w, h, r) {
    ctx.beginPath();
    roundedPath(ctx, x, y, w, h, r);
    ctx.clip();
}

function roundedPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

function coverImage(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
