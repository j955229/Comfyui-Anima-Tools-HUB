class AnimaArtistTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "artist_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"
    def process_tags(self, artist_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in artist_tags.split(",") if t.strip()]
        processed_tags = []
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            elif clean_tag.lower().startswith("by "):
                clean_tag = clean_tag[3:].strip()
            if clean_tag:
                processed_tags.append(f"@{clean_tag}")
        joined_artists = ", ".join(processed_tags)

        # 结合外部 prompt
        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                # 追加模式：选择的画师 tag 在前，外接的 opt_prompt 在后，末尾补上逗号
                if joined_artists:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_artists}, {opt_prompt}"
                    else:
                        final_text = f"{joined_artists}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                # 覆盖模式：直接输出画师 tags，并在末尾带上逗号
                if joined_artists:
                    final_text = f"{joined_artists}, "
                else:
                    final_text = ""
        else:
            if joined_artists:
                final_text = f"{joined_artists}, "
            else:
                final_text = ""

        return (final_text,)

class AnimaArtistTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "artist_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, artist_tags, extra_text, separator=", "):
        # 1. 过滤并处理画师 tags
        tags_list = [t.strip() for t in artist_tags.split(",") if t.strip()]
        processed_tags = []
        
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            elif clean_tag.lower().startswith("by "):
                clean_tag = clean_tag[3:].strip()
            
            if clean_tag:
                processed_tags.append(f"@{clean_tag}")
        
        joined_artists = ", ".join(processed_tags)
        # 🌟 只要有画师，尾部必带逗号与空格，保证输出框及默认状态下的绝对完美隔开
        if joined_artists:
            joined_artists += ", "

        # 2. 将两段自动拼接到一起 (画师在前，自定义提示词在后)
        extra_text_clean = extra_text.strip() if extra_text else ""
        
        if extra_text_clean and joined_artists:
            # 画师在前，提示词在后
            # 🌟 智能合并去重：如果分隔符是逗号或被删空，则直接利用 joined_artists 尾部的逗号连接，避免产生多余的双逗号
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_artists}{extra_text_clean}"
            else:
                # 否则，剥离画师尾部逗号，使用用户填写的自定义非逗号分隔符连接
                final_text = f"{joined_artists.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_artists

        return (final_text,)

class AnimaCharacterTagSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "character_tags": ("STRING", {"multiline": True, "default": ""}),
                "mode": (["append", "override"], {"default": "append"}),
            },
            "optional": {
                "opt_prompt": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, character_tags, mode, opt_prompt=""):
        tags_list = [t.strip() for t in character_tags.split(",") if t.strip()]
        processed_tags = []
        
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            
            if clean_tag:
                processed_tags.append(clean_tag)
        
        joined_characters = ", ".join(processed_tags)

        if opt_prompt and opt_prompt.strip():
            opt_prompt = opt_prompt.strip()
            if mode == "append":
                # 追加模式：选择的角色 tag 在前，外接的 opt_prompt 在后，末尾补上逗号
                if joined_characters:
                    if opt_prompt.endswith(","):
                        final_text = f"{joined_characters}, {opt_prompt}"
                    else:
                        final_text = f"{joined_characters}, {opt_prompt}, "
                else:
                    final_text = opt_prompt
            else:
                if joined_characters:
                    final_text = f"{joined_characters}, "
                else:
                    final_text = ""
        else:
            if joined_characters:
                final_text = f"{joined_characters}, "
            else:
                final_text = ""

        return (final_text,)

class AnimaCharacterTagSelectorPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "character_tags": ("STRING", {"multiline": True, "default": ""}),
                "extra_text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_tags"
    CATEGORY = "AnimaArt"

    def process_tags(self, character_tags, extra_text, separator=", "):
        tags_list = [t.strip() for t in character_tags.split(",") if t.strip()]
        processed_tags = []
        
        for tag in tags_list:
            if tag.startswith("_raw_:"):
                processed_tags.append(tag[6:])
                continue
            clean_tag = tag
            if clean_tag.startswith("@"):
                clean_tag = clean_tag[1:].strip()
            
            if clean_tag:
                processed_tags.append(clean_tag)
        
        joined_characters = ", ".join(processed_tags)
        if joined_characters:
            joined_characters += ", "

        extra_text_clean = extra_text.strip() if extra_text else ""
        
        if extra_text_clean and joined_characters:
            sep = separator if separator is not None else ", "
            if sep.strip() == "," or sep.strip() == "":
                final_text = f"{joined_characters}{extra_text_clean}"
            else:
                final_text = f"{joined_characters.rstrip(', ')}{sep}{extra_text_clean}"
        elif extra_text_clean:
            final_text = extra_text_clean
        else:
            final_text = joined_characters

        return (final_text,)

NODE_CLASS_MAPPINGS = {
    "AnimaArtistTagSelector": AnimaArtistTagSelector,
    "AnimaArtistTagSelectorPlus": AnimaArtistTagSelectorPlus,
    "AnimaCharacterTagSelector": AnimaCharacterTagSelector,
    "AnimaCharacterTagSelectorPlus": AnimaCharacterTagSelectorPlus
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AnimaArtistTagSelector": "Anima Artist Tag Selector",
    "AnimaArtistTagSelectorPlus": "Anima Artist Tag Selector+",
    "AnimaCharacterTagSelector": "Anima Character Tag Selector",
    "AnimaCharacterTagSelectorPlus": "Anima Character Tag Selector+"
}

# ----------------- 后端持久化 API 路由 -----------------
import folder_paths
from server import PromptServer
from aiohttp import web
import json
import os

def get_favorites_path():
    try:
        user_dir = folder_paths.get_user_directory()
    except AttributeError:
        # 降级方案：寻找 ComfyUI 根目录下的 user 文件夹
        user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "user"))
        if not os.path.exists(user_dir):
            user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "user"))
    
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "anima_tools_favorites.json")

@PromptServer.instance.routes.get("/anima-tools/favorites")
async def get_favorites_api(request):
    path = get_favorites_path()
    default_data = {
        "artist": {
            "groups": [{"id": "default", "name": "默认收藏", "isSystem": True}],
            "items": []
        },
        "character": {
            "groups": [{"id": "default", "name": "默认收藏", "isSystem": True}],
            "items": []
        }
    }
    
    if not os.path.exists(path):
        return web.json_response(default_data)
        
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                data = {}
            for key in ["artist", "character"]:
                if key not in data or not isinstance(data[key], dict):
                    data[key] = default_data[key]
                if "groups" not in data[key] or not isinstance(data[key]["groups"], list):
                    data[key]["groups"] = default_data[key]["groups"]
                if "items" not in data[key] or not isinstance(data[key]["items"], list):
                    data[key]["items"] = []
                # 确保默认收藏分组存在
                if not any(g.get("id") == "default" for g in data[key]["groups"]):
                    data[key]["groups"].insert(0, default_data[key]["groups"][0])
            return web.json_response(data)
    except Exception as e:
        print(f"[Anima Tools] Error reading favorites: {e}")
        return web.json_response(default_data)

@PromptServer.instance.routes.post("/anima-tools/favorites")
async def save_favorites_api(request):
    try:
        body = await request.json()
        path = get_favorites_path()
        
        # 原子写入：先写入 .tmp 文件再覆盖
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(body, f, indent=2, ensure_ascii=False)
            
        os.replace(tmp_path, path)
        return web.json_response({"success": True})
    except Exception as e:
        print(f"[Anima Tools] Error saving favorites: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)

