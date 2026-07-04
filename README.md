# ComfyUI Anima Tools Hub

ComfyUI Anima Tools Hub 是一組給動漫圖片工作流使用的 ComfyUI 自訂節點與前端工具。它把畫師、人物、服裝、背景、姿勢、LoRA 與 prompt 組合流程集中到同一套工具裡，目標是讓選 tag、複製 tag、套用到指定節點都更快。

這個 fork 目前重點放在新的 Anima Tools Hub。舊的 selector 按鈕仍保留，按下後會開啟新的 Hub 介面，避免工作流裡既有節點失效。

## 目前主要功能

### Anima Tools Hub

- 集中式 Hub 介面，支援畫師、人物、服裝、背景、姿勢五個大分類。
<img width="1612" height="882" alt="image" src="https://github.com/user-attachments/assets/6823f9e6-6448-497f-9434-59e81ccd1180" />
- 側邊分類導覽，服裝、背景、姿勢支援大分類與子分類篩選。
- 搜尋文字會依分類保留，切換分類或關閉 Hub 後再打開仍會保留。
- 支援 Favorites 我的最愛。
- 支援 Copy、Copy Selected、Apply to Target。
- Apply to Target 後會關閉 Hub；沒有選取內容時也會關閉，且不套用 tag。
- 卡片 hover 後顯示操作區，未 hover 時保留圖片與標題。
- 卡片支援圖片放大預覽，點空白處可關閉。
- 選中的卡片會顯示更明顯的外框、光暈與 Selected 標籤。
- Trigger 與 Tags 可直接在卡片內原地編輯，編輯內容會存在瀏覽器 localStorage。

### 畫師資料

- 支援 Theta 畫師資料。
- 支援 Mooshie 畫師資料。
- 支援 Merged 合併來源。
- Mooshie 畫師的兩張範例圖以 `#1/#2` 切換顯示。
- 切換圖片時有卡面翻轉動畫。

### 人物資料

- 人物分類目前以 Animadex 作為主要資料來源。
- 人物卡片支援 Trigger 與 Trigger + Tags 兩種套用模式。
- 已選中的 Trigger 或 Trigger + Tags 再點一次可取消選取。
- 人物系列名稱可點擊搜尋同系列角色。
- Tags 可點擊搜尋擁有同 tag 的角色。
- 人物卡片下方只保留人物名稱與系列，不再顯示 works 數量。

### 服裝、背景、姿勢

- 改成側邊分類架構。
- 標題與分類名稱改為簡體中文 UI 標籤。
- 卡片使用圖片主導的顯示方式，hover 後才顯示操作。

### LoRA 工具

- 保留 Anima LoRA Loader 與 LoRA 管理相關功能。
- 支援本地 LoRA 預覽、遠端預覽快取與 Civitai 搜尋流程。

## 已改掉或不再作為主要入口的功能

- 舊版分散 selector 面板不再作為主要入口，按鈕保留並導向 Anima Tools Hub。
- 人物分類不再提供 Local / Animadex / Merged 來源切換，目前集中使用 Animadex。
- Mooshie 畫師範例圖不再一次顯示兩張，改為卡片內 `#1/#2` 切換。
- 人物卡片不再顯示 `xxx works` 作為副標題。

## 安裝

將此 repo 放到 ComfyUI 的 `custom_nodes` 目錄：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/j955229/Comfyui-Anima-Tools-HUB.git
```

重新啟動 ComfyUI 後，在節點選單中尋找 Anima Tools 相關節點。

## 主要檔案

```text
nodes.py                         Python 節點與後端 API
anima_lora_api.py                LoRA 管理與預覽 API
js/anima_hub.js                  Anima Tools Hub 主介面
js/anima_artist_sources.js       Theta / Mooshie / Merged 畫師來源
js/anima_character_sources.js    Animadex 人物來源
js/anima_taxonomy.js             分類與子分類規則
js/anima_target_resolver.js      Hub 套用目標解析
js/*_data.js                     服裝、背景、姿勢等本地資料
```

## 資料來源與致謝

- [AnimaDex](https://github.com/zetaneko/AnimaDex)：人物資料與人物卡片設計參考。
- [Anima-Style-Explorer](https://github.com/ThetaCursed/Anima-Style-Explorer)：Theta 畫師資料來源。
- [Mooshie Anima](https://anima.mooshieblob.com/)：Mooshie 畫師資料與卡片切換互動參考。
- 原始 ComfyUI Anima Tools 專案與相關節點設計。

## 授權

本 fork 依原專案授權延續。使用前請同時確認原專案、資料來源與各外部服務的授權條款。
