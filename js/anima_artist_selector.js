import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { addSelectorActionRow, installSelectorExecutionSync } from "./anima_selector_random.js";
import { openAnimaHub } from "./anima_hub.js";

app.registerExtension({
    name: "AnimaArtistTagSelector.extension",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "AnimaArtistTagSelector" || nodeData.name === "AnimaArtistTagSelectorPlus" || nodeData.name === "AnimaPromptPlus") {
            installSelectorExecutionSync(nodeType);
            const origOnCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                origOnCreated?.apply(this, arguments);

                // 找到 artist_tags widget
                const artistTagsWidget = this.widgets.find(w => w.name === "artist_tags");
                if (!artistTagsWidget) return;
                
                addSelectorActionRow(this, {
                    section: "artist",
                    label: t("Open Artist Selector"),
                    accent: "#0b8ce9",
                    accentText: "#7dd3fc",
                    onOpen: async () => {
                        openAnimaHub("artist", this);
                    },
                });
            };
        }
    }
});
