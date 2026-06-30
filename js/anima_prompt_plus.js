import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";

app.registerExtension({
    name: "AnimaPromptPlus.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "AnimaPromptPlus") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            setTimeout(() => reorderSelectorButtons(this), 0);
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = origOnConfigure?.apply(this, arguments);
            setTimeout(() => reorderSelectorButtons(this), 0);
            return result;
        };
    }
});

function reorderSelectorButtons(node) {
    if (!node?.widgets?.length) return;

    const sectionOrder = new Map([
        ["artist", 0],
        ["character", 1],
        ["clothing", 2],
        ["pose", 3],
        ["background", 4],
    ]);
    const labelOrder = new Map([
        [t("Open Artist Selector"), 0],
        [t("Open Character Selector"), 1],
        [t("Open Clothing Selector"), 2],
        [t("Open Pose Selector"), 3],
        [t("Open Background Selector"), 4],
    ]);

    const indexed = node.widgets
        .map((widget, index) => ({
            widget,
            index,
            rank: sectionOrder.get(widget?.__animaSelectorActionSection) ?? labelOrder.get(widget?.name),
        }))
        .filter(item => item.rank !== undefined);

    if (indexed.length < 2) return;

    const firstIndex = Math.min(...indexed.map(item => item.index));
    const buttonSet = new Set(indexed.map(item => item.widget));
    const sortedButtons = indexed
        .sort((a, b) => a.rank - b.rank)
        .map(item => item.widget);

    node.widgets = [
        ...node.widgets.slice(0, firstIndex).filter(widget => !buttonSet.has(widget)),
        ...sortedButtons,
        ...node.widgets.slice(firstIndex).filter(widget => !buttonSet.has(widget)),
    ];

    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
}
