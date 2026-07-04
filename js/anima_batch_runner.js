import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, refreshNode, setWidgetValue } from "./anima_apply_tags.js";

const SOURCE_ORDER = ["expression", "lighting", "composition"];
const SOURCE_WIDGETS = {
    expression: "expression_tags",
    lighting: "lighting_tags",
    composition: "composition_tags",
};

app.registerExtension({
    name: "AnimaBatchWildcardRunner.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "AnimaBatchWildcardRunner") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            setupBatchRunnerNode(this);
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = origOnConfigure?.apply(this, arguments);
            setupBatchRunnerNode(this);
            return result;
        };
    },
});

function setupBatchRunnerNode(node) {
    if (!node || node._animaBatchRunnerReady) return;
    node._animaBatchRunnerReady = true;
    node._animaBatchState = node._animaBatchState || createBatchState();

    if (typeof node.addDOMWidget !== "function") {
        node.addWidget("button", "Start Batch", null, () => startBatch(node));
        node.addWidget("button", "Pause", null, () => pauseBatch(node));
        node.addWidget("button", "Resume", null, () => resumeBatch(node));
        node.addWidget("button", "Stop", null, () => stopBatch(node));
        return;
    }

    const panel = document.createElement("div");
    panel.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 0 2px;
        pointer-events: none;
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #d1d5db;
    `;

    const hint = document.createElement("div");
    hint.textContent = "Queues wildcard lines in order. All = expression, lighting, composition.";
    hint.style.cssText = `
        color: #9ca3af;
        font-size: 11px;
        padding: 0 2px;
    `;

    const row = document.createElement("div");
    row.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        pointer-events: auto;
    `;

    const startButton = makeButton("Start", "#0ea5e9");
    const pauseButton = makeButton("Pause", "#64748b");
    const resumeButton = makeButton("Resume", "#22c55e");
    const stopButton = makeButton("Stop", "#ef4444");

    startButton.addEventListener("click", event => {
        stopEvent(event);
        startBatch(node);
    });
    pauseButton.addEventListener("click", event => {
        stopEvent(event);
        pauseBatch(node);
    });
    resumeButton.addEventListener("click", event => {
        stopEvent(event);
        resumeBatch(node);
    });
    stopButton.addEventListener("click", event => {
        stopEvent(event);
        stopBatch(node);
    });

    row.appendChild(startButton);
    row.appendChild(pauseButton);
    row.appendChild(resumeButton);
    row.appendChild(stopButton);
    panel.appendChild(hint);
    panel.appendChild(row);

    const widget = node.addDOMWidget("anima_batch_controls", "div", panel, {
        serialize: false,
        hideOnZoom: false,
        getValue: () => "",
        setValue: () => {},
    });
    widget.serialize = false;
    widget.computeSize = width => [width, 74];
    widget.computedHeight = 74;
    node._animaBatchControls = widget;

    resizeRunnerNode(node);
}

function makeButton(label, accent) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = `
        min-width: 0;
        height: 28px;
        border-radius: 7px;
        border: 1px solid color-mix(in srgb, ${accent} 48%, rgba(255,255,255,0.16));
        background: color-mix(in srgb, ${accent} 22%, rgba(15,23,42,0.92));
        color: #f8fafc;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: filter 0.14s ease, transform 0.14s ease;
    `;
    button.addEventListener("pointerdown", stopEvent);
    button.addEventListener("mousedown", stopEvent);
    button.addEventListener("mouseenter", () => {
        button.style.filter = "brightness(1.12)";
    });
    button.addEventListener("mouseleave", () => {
        button.style.filter = "none";
        button.style.transform = "none";
    });
    button.addEventListener("pointerup", () => {
        button.style.transform = "none";
    });
    return button;
}

function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
}

function createBatchState() {
    return {
        running: false,
        paused: false,
        stopped: false,
        current: 0,
        total: 0,
    };
}

function resizeRunnerNode(node) {
    const width = Math.max(380, node.size?.[0] || 380);
    const computedSize = typeof node.computeSize === "function" ? node.computeSize() : null;
    const height = Math.max(300, computedSize?.[1] || node.size?.[1] || 300);
    if (node.setSize) node.setSize([width, height + 18]);
    else node.size = [width, height + 18];
    refreshNode(node);
}

async function startBatch(node) {
    const state = node._animaBatchState || createBatchState();
    node._animaBatchState = state;
    if (state.running) {
        setStatus(node, "Batch is already running.");
        return;
    }

    state.running = true;
    state.paused = false;
    state.stopped = false;
    state.current = 0;
    state.total = 0;

    try {
        setStatus(node, "Loading wildcard files...");
        const sources = await fetchWildcardSources();
        const tasks = buildTasks(node, sources);
        state.total = tasks.length;

        if (!tasks.length) {
            setStatus(node, "No tasks to queue. Check source, start_index, and run_count.");
            return;
        }

        const delay = readIntWidget(node, "queue_delay_ms", 500);
        for (let i = 0; i < tasks.length; i++) {
            if (state.stopped) break;
            await waitWhilePaused(node, state);
            if (state.stopped) break;

            const task = tasks[i];
            applyTaskToWorkflow(node, task);
            state.current = i + 1;
            setStatus(node, `Queueing ${state.current}/${state.total}: ${task.source} #${task.lineNumber}`);
            await queueCurrentWorkflow();
            await waitWithControls(node, state, delay);
        }

        if (state.stopped) {
            setStatus(node, `Stopped at ${state.current}/${state.total}.`);
        } else {
            setStatus(node, `Done. Queued ${state.total} prompts.`);
        }
    } catch (error) {
        console.error("[Anima Tools] Batch runner failed", error);
        setStatus(node, `Failed: ${error?.message || error}`);
    } finally {
        state.running = false;
        state.paused = false;
        refreshNode(node);
    }
}

function pauseBatch(node) {
    const state = node._animaBatchState;
    if (!state?.running) {
        setStatus(node, "No running batch to pause.");
        return;
    }
    state.paused = true;
    setStatus(node, `Paused at ${state.current}/${state.total}.`);
}

function resumeBatch(node) {
    const state = node._animaBatchState;
    if (!state?.running) {
        setStatus(node, "No paused batch to resume.");
        return;
    }
    state.paused = false;
    setStatus(node, `Resumed at ${state.current}/${state.total}.`);
}

function stopBatch(node) {
    const state = node._animaBatchState;
    if (!state?.running) {
        setStatus(node, "No running batch to stop.");
        return;
    }
    state.stopped = true;
    state.paused = false;
    setStatus(node, `Stopping after ${state.current}/${state.total}.`);
}

async function fetchWildcardSources() {
    const response = api?.fetchApi
        ? await api.fetchApi("/anima-tools/batch-wildcards")
        : await fetch("/anima-tools/batch-wildcards");
    if (!response.ok) {
        throw new Error(`Wildcard API returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload?.success || !payload?.sources) {
        throw new Error(payload?.error || "Wildcard API returned no sources");
    }
    return payload.sources;
}

function buildTasks(node, sources) {
    const batchSource = String(readWidget(node, "batch_source", "all") || "all");
    const selectedSources = batchSource === "all" ? SOURCE_ORDER : [batchSource];
    const startIndex = Math.max(1, readIntWidget(node, "start_index", 1));
    const runCount = Math.max(0, readIntWidget(node, "run_count", 0));
    const tasks = [];

    selectedSources.forEach(source => {
        const lines = Array.isArray(sources?.[source]?.lines) ? sources[source].lines : [];
        const start = startIndex - 1;
        const end = runCount > 0 ? start + runCount : lines.length;
        lines.slice(start, end).forEach((value, offset) => {
            tasks.push({
                source,
                value,
                lineNumber: startIndex + offset,
                widgetName: resolveTargetWidget(node, source),
            });
        });
    });

    return tasks;
}

function resolveTargetWidget(node, source) {
    const requested = String(readWidget(node, "target_widget", "auto") || "auto").trim();
    if (!requested || requested.toLowerCase() === "auto") {
        return SOURCE_WIDGETS[source] || "";
    }
    return requested;
}

function applyTaskToWorkflow(runnerNode, task) {
    const targetNode = findTargetNode(task.widgetName, runnerNode);
    if (!targetNode) {
        throw new Error(`No target widget found: ${task.widgetName}. Add or select a node with this widget.`);
    }
    const applied = setWidgetValue(targetNode, task.widgetName, task.value);
    if (!applied) {
        throw new Error(`Target node found, but widget cannot be edited: ${task.widgetName}`);
    }
}

function findTargetNode(widgetName, runnerNode) {
    if (!widgetName) return null;
    const selected = getSelectedNodes().filter(node => node !== runnerNode && hasTargetWidget(node, widgetName));
    if (selected.length) return selected[0];
    return getGraphNodes().find(node => node !== runnerNode && hasTargetWidget(node, widgetName)) || null;
}

function hasTargetWidget(node, widgetName) {
    if (!node || !widgetName) return false;
    if (getWidget(node, widgetName)) return true;
    return Array.isArray(node.inputs) && node.inputs.some(input => {
        const inputName = input?.name || "";
        const widgetNameFromInput = input?.widget?.name || "";
        return inputName === widgetName || widgetNameFromInput === widgetName;
    });
}

function getGraphNodes() {
    const graph = app?.graph || app?.canvas?.graph || window?.LGraphCanvas?.active_canvas?.graph;
    const buckets = [
        graph?._nodes,
        graph?.nodes,
        graph?._nodes_by_id ? Object.values(graph._nodes_by_id) : null,
    ];
    const nodes = [];
    const seen = new Set();
    buckets.forEach(bucket => {
        if (!Array.isArray(bucket)) return;
        bucket.forEach(node => {
            if (!node || seen.has(node.id)) return;
            seen.add(node.id);
            nodes.push(node);
        });
    });
    return nodes;
}

function getSelectedNodes() {
    const selected = app?.canvas?.selected_nodes;
    if (!selected || typeof selected !== "object") return [];
    return Object.values(selected).filter(Boolean);
}

async function queueCurrentWorkflow() {
    if (typeof app?.graphToPrompt === "function" && typeof api?.queuePrompt === "function") {
        const prompt = await app.graphToPrompt();
        return await api.queuePrompt(-1, prompt);
    }
    if (typeof app?.queuePrompt === "function") {
        return await app.queuePrompt(0, 1);
    }
    throw new Error("ComfyUI queue API is unavailable");
}

async function waitWhilePaused(node, state) {
    while (state.paused && !state.stopped) {
        setStatus(node, `Paused at ${state.current}/${state.total}.`);
        await sleep(250);
    }
}

async function waitWithControls(node, state, ms) {
    const delay = Math.max(0, Number(ms) || 0);
    const endAt = Date.now() + delay;
    while (Date.now() < endAt && !state.stopped) {
        await waitWhilePaused(node, state);
        await sleep(Math.min(250, Math.max(0, endAt - Date.now())));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function readWidget(node, name, fallback) {
    const widget = getWidget(node, name);
    return widget ? widget.value : fallback;
}

function readIntWidget(node, name, fallback) {
    const value = Number.parseInt(readWidget(node, name, fallback), 10);
    return Number.isFinite(value) ? value : fallback;
}

function setStatus(node, message) {
    const text = String(message ?? "");
    setWidgetValue(node, "status", text);
    refreshNode(node);
}
