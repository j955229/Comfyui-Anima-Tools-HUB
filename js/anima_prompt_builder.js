import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "AnimaPromptBuilder.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "AnimaSceneCollector") return;

        const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, index, connected, linkInfo, inputInfo) {
            const result = origOnConnectionsChange?.apply(this, arguments);
            if (type === 1) {
                updateCharacterInputs(this);
            }
            return result;
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = origOnConfigure?.apply(this, arguments);
            setTimeout(() => updateCharacterInputs(this), 0);
            return result;
        };
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
        node.setSize?.(node.computeSize?.() || node.size);
        node.graph?.setDirtyCanvas?.(true, true);
        app?.graph?.setDirtyCanvas?.(true, true);
    }
}

function getCharacterInputs(node) {
    return node.inputs.filter(input => input?.name && /^character\d+$/.test(input.name));
}

function getCharacterInputNumber(input, fallback) {
    const match = String(input?.name || "").match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : fallback;
}
