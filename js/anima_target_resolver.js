import { app } from "../../scripts/app.js";
import { getWidget } from "./anima_apply_tags.js";

export const ANIMA_SECTION_WIDGETS = {
    artist: "artist_tags",
    character: "character_tags",
    clothing: "clothing_tags",
    background: "background_tags",
    pose: "pose_tags",
    composition: "composition_tags",
    expression: "expression_tags",
    lighting: "lighting_tags",
    custom_combo: "custom_combo",
};

const PROMPT_BUILDER_SECTION_WIDGETS = {
    AnimaCharacterSpec: {
        character: "name",
        clothing: "clothes",
        expression: "expression",
        pose: "action",
    },
    AnimaSceneCollector: {
        background: "background",
        lighting: "lighting",
        composition: "composition",
    },
    AnimaFinalAssembler: {
        artist: "artist",
    },
};

function getGraphNodes() {
    const nodes = app?.graph?._nodes;
    return Array.isArray(nodes) ? nodes.filter(Boolean) : [];
}

function getNodeTitle(node) {
    return String(node?.title || node?.type || node?.comfyClass || `Node ${node?.id ?? ""}`).trim();
}

function getNodeType(node) {
    return String(node?.comfyClass || node?.type || "");
}

function getPromptBuilderWidgetName(section, node) {
    return PROMPT_BUILDER_SECTION_WIDGETS[getNodeType(node)]?.[section] || "";
}

export function resolveAnimaTargets(section = "artist", preferredNode = null) {
    if (!ANIMA_SECTION_WIDGETS[section]) {
        return [];
    }

    const targets = [];
    for (const node of getGraphNodes()) {
        const widgetName = getPromptBuilderWidgetName(section, node) || ANIMA_SECTION_WIDGETS[section];
        if (!getWidget(node, widgetName)) {
            continue;
        }
        targets.push({
            id: `${node.id}:${widgetName}`,
            node,
            nodeId: node.id,
            nodeType: node.type || node.comfyClass || "",
            widgetName,
            section,
            label: `${getNodeTitle(node)} #${node.id} -> ${widgetName}`,
        });
    }

    if (preferredNode) {
        targets.sort((a, b) => {
            if (a.node === preferredNode) return -1;
            if (b.node === preferredNode) return 1;
            return 0;
        });
    }

    return targets;
}

export function getTargetById(section, id, preferredNode = null) {
    const targets = resolveAnimaTargets(section, preferredNode);
    return targets.find(target => target.id === id) || targets[0] || null;
}
