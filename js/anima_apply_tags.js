import { app } from "../../scripts/app.js";

export function getWidget(node, name) {
    return node?.widgets?.find(widget => widget?.name === name) || null;
}

export function refreshNode(node) {
    node?.setDirtyCanvas?.(true, true);
    node?.graph?.setDirtyCanvas?.(true, true);
    app?.graph?.setDirtyCanvas?.(true, true);
    app?.canvas?.setDirtyCanvas?.(true, true);
    app?.canvas?.draw?.(true, true);
}

export function setWidgetValue(node, widgetName, value) {
    const widget = getWidget(node, widgetName);
    if (!widget) {
        return false;
    }

    const text = String(value ?? "");
    widget.value = text;
    if (widget.inputEl) {
        widget.inputEl.value = text;
        widget.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    widget.callback?.(text);
    refreshNode(node);
    return true;
}

export function applyTagsToTarget(target, value) {
    if (!target?.node || !target?.widgetName) {
        return false;
    }
    return setWidgetValue(target.node, target.widgetName, value);
}

