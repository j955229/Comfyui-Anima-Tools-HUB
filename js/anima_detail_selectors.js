import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { addSelectorActionRow, installSelectorExecutionSync } from "./anima_selector_random.js";
import { openAnimaHub } from "./anima_hub.js";
import "./composition_data.js";
import "./expression_data.js";
import "./lighting_data.js";

const DETAIL_SELECTORS = [
    {
        section: "composition",
        widget: "composition_tags",
        label: "Open Composition Selector",
        loading: "Anima composition database is loading, please wait a few seconds...",
        dataKey: "compositionData",
        nodes: ["AnimaCompositionTagSelector", "AnimaCompositionTagSelectorPlus"],
    },
    {
        section: "expression",
        widget: "expression_tags",
        label: "Open Expression Selector",
        loading: "Anima expression database is loading, please wait a few seconds...",
        dataKey: "expressionData",
        nodes: ["AnimaExpressionTagSelector", "AnimaExpressionTagSelectorPlus"],
    },
    {
        section: "lighting",
        widget: "lighting_tags",
        label: "Open Lighting Selector",
        loading: "Anima lighting database is loading, please wait a few seconds...",
        dataKey: "lightingData",
        nodes: ["AnimaLightingTagSelector", "AnimaLightingTagSelectorPlus"],
    },
];

const SELECTOR_BY_NODE = new Map(
    DETAIL_SELECTORS.flatMap(config => config.nodes.map(nodeName => [nodeName, config]))
);

app.registerExtension({
    name: "AnimaDetailTagSelectors.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        const config = SELECTOR_BY_NODE.get(nodeData.name);
        if (!config) return;

        installSelectorExecutionSync(nodeType);
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);

            const tagsWidget = this.widgets?.find(widget => widget?.name === config.widget);
            if (!tagsWidget) return;

            addSelectorActionRow(this, {
                section: config.section,
                label: t(config.label),
                onOpen: async () => {
                    if (!window[config.dataKey]) {
                        alert(t(config.loading));
                        return;
                    }
                    openAnimaHub(config.section, this);
                },
            });
        };
    },
});
