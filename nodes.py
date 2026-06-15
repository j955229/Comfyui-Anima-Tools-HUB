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

class AnimaMultiLoraLoader:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "lora_list_json": ("STRING", {"default": "[]", "multiline": True}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP")
    RETURN_NAMES = ("MODEL", "CLIP")
    FUNCTION = "load_loras"
    CATEGORY = "AnimaArt"

    def load_loras(self, model, clip, lora_list_json):
        import json
        import comfy.sd
        import comfy.utils
        import folder_paths
        from .anima_lora_api import get_lora_save_dir
        
        try:
            loras = json.loads(lora_list_json)
        except Exception as e:
            print(f"[Anima Tools] Error parsing lora_list_json: {e}")
            loras = []
            
        current_model = model
        current_clip = clip
        
        for lora_entry in loras:
            if not lora_entry.get("enabled", True):
                continue
                
            lora_name = lora_entry.get("name")
            strength_model = float(lora_entry.get("strength_model", 1.0))
            strength_clip = float(lora_entry.get("strength_clip", 1.0))
            
            if not lora_name:
                continue
                
            # 查找 LoRA 文件路径
            lora_path = folder_paths.get_full_path("loras", lora_name)
            
            if not lora_path:
                custom_dir = get_lora_save_dir()
                candidate = os.path.join(custom_dir, lora_name)
                if os.path.isfile(candidate):
                    lora_path = candidate
                else:
                    candidate_rel = os.path.join(custom_dir, lora_name.replace("/", os.sep))
                    if os.path.isfile(candidate_rel):
                        lora_path = candidate_rel
            
            if not lora_path:
                # 模糊匹配
                found_match = False
                for system_lora in folder_paths.get_filename_list("loras"):
                    if os.path.basename(system_lora) == os.path.basename(lora_name):
                        lora_path = folder_paths.get_full_path("loras", system_lora)
                        found_match = True
                        break
                if not found_match:
                    print(f"[Anima Tools] LoRA file not found: {lora_name}, skipping.")
                    continue
                    
            try:
                print(f"[Anima Tools] Applying LoRA: {lora_name} -> Model Strength: {strength_model}, Clip Strength: {strength_clip}")
                lora_data = comfy.utils.load_torch_file(lora_path, safe_load=True)
                current_model, current_clip = comfy.sd.load_lora_for_models(
                    current_model, current_clip, lora_data, strength_model, strength_clip
                )
            except Exception as e:
                print(f"[Anima Tools] Failed to load LoRA {lora_name}: {e}")
                
        return (current_model, current_clip)


NODE_CLASS_MAPPINGS = {
    "AnimaArtistTagSelector": AnimaArtistTagSelector,
    "AnimaArtistTagSelectorPlus": AnimaArtistTagSelectorPlus,
    "AnimaCharacterTagSelector": AnimaCharacterTagSelector,
    "AnimaCharacterTagSelectorPlus": AnimaCharacterTagSelectorPlus,
    "AnimaMultiLoraLoader": AnimaMultiLoraLoader
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AnimaArtistTagSelector": "Anima Artist Tag Selector",
    "AnimaArtistTagSelectorPlus": "Anima Artist Tag Selector+",
    "AnimaCharacterTagSelector": "Anima Character Tag Selector",
    "AnimaCharacterTagSelectorPlus": "Anima Character Tag Selector+",
    "AnimaMultiLoraLoader": "Anima Multi LoRA Loader"
}

# ----------------- 后端持久化 API 路由 -----------------
import folder_paths
from server import PromptServer
from aiohttp import web
import json
import os
import hashlib
import threading
import time
import urllib.parse
import urllib.request
from io import BytesIO
try:
    from PIL import Image
except ImportError:
    Image = None

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
        },
        "lora": {
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
            for key in ["artist", "character", "lora"]:
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


# ----------------- LoRA 相关的 API 路由 -----------------
from .anima_lora_api import (
    search_civitai_loras,
    start_download_task,
    get_download_job_status,
    load_config as load_lora_config,
    save_config as save_lora_config,
    get_lora_save_dir,
    download_preview_image,
    fetch_civitai_model
)

def scan_loras_in_directory(directory: str) -> list:
    results = []
    if not directory or not os.path.isdir(directory):
        return results
    directory = os.path.abspath(directory)
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".safetensors"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, directory)
                rel_path = rel_path.replace(os.sep, "/")
                results.append(rel_path)
    return results

def get_anima_tools_user_dir() -> str:
    try:
        user_dir = folder_paths.get_user_directory()
    except AttributeError:
        user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "user"))
        if not os.path.exists(user_dir):
            user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "user"))
    cache_root = os.path.join(user_dir, "anima_tools")
    os.makedirs(cache_root, exist_ok=True)
    return cache_root

def get_lora_roots() -> list[str]:
    roots = []
    try:
        for path in folder_paths.get_folder_paths("loras"):
            if path and os.path.isdir(path):
                roots.append(os.path.abspath(path))
    except Exception:
        pass

    fallback = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "loras"))
    if os.path.isdir(fallback):
        roots.append(fallback)

    config = load_lora_config()
    custom_dir = config.get("custom_lora_dir", "").strip()
    if custom_dir and os.path.isdir(custom_dir):
        roots.append(os.path.abspath(custom_dir))

    deduped = []
    seen = set()
    for root in roots:
        key = os.path.normcase(os.path.abspath(root))
        if key not in seen:
            seen.add(key)
            deduped.append(root)
    return deduped

def scan_loras_with_info() -> list[dict]:
    results = []
    seen = set()
    for root in get_lora_roots():
        for rel_path in scan_loras_in_directory(root):
            if rel_path in seen:
                continue
            abs_path = os.path.join(root, rel_path.replace("/", os.sep))
            if not os.path.isfile(abs_path):
                continue
            seen.add(rel_path)
            results.append({"filename": rel_path, "abs_path": abs_path})
    return results

def resolve_lora_abs_path(filename: str) -> str | None:
    if not filename:
        return None
    filename = filename.replace("\\", "/").strip()
    if not filename or filename.endswith("/"):
        return None

    try:
        abs_path = folder_paths.get_full_path("loras", filename)
    except Exception:
        abs_path = None

    if abs_path and os.path.exists(abs_path):
        return abs_path

    for root in get_lora_roots():
        candidate = os.path.join(root, filename.replace("/", os.sep))
        if os.path.exists(candidate):
            return candidate
    return None

def find_companion_preview(abs_path: str) -> str | None:
    if not abs_path:
        return None
    base_no_ext = os.path.splitext(abs_path)[0]
    for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"]:
        for suffix in ["", ".preview"]:
            preview_file = base_no_ext + suffix + ext
            if os.path.exists(preview_file):
                return preview_file
    return None

def get_preview_cache_key(abs_path: str, preview_file: str | None = None) -> str:
    stat_path = preview_file if preview_file and os.path.exists(preview_file) else abs_path
    try:
        stat = os.stat(stat_path)
        raw = f"{os.path.abspath(stat_path)}|{int(stat.st_mtime)}|{stat.st_size}"
    except OSError:
        raw = f"{os.path.abspath(stat_path)}|missing"
    return hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()[:20]

def make_display_name(filename: str) -> str:
    name = os.path.basename(filename.replace("\\", "/"))
    if name.lower().endswith(".safetensors"):
        name = name[:-12]
    return name

def read_lora_meta_summary(abs_path: str) -> tuple[str, dict]:
    meta_path = os.path.splitext(abs_path)[0] + ".json"
    if not os.path.exists(meta_path):
        return "missing", {}
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        model = data.get("model", {}) if isinstance(data, dict) else {}
        version = data.get("version", {}) if isinstance(data, dict) else {}
        creator = model.get("creator", {}) if isinstance(model.get("creator"), dict) else {}
        return "cached", {
            "name": model.get("name") or version.get("modelName") or "",
            "creator": creator.get("username") or "",
            "version": version.get("name") or "",
            "trained_words": version.get("trainedWords", [])[:8] if isinstance(version.get("trainedWords"), list) else [],
            "preview_url": (version.get("images") or [{}])[0].get("url", "") if isinstance(version.get("images"), list) and version.get("images") else ""
        }
    except Exception as e:
        print(f"[Anima Tools] Failed to read metadata summary for {abs_path}: {e}")
        return "missing", {}

@PromptServer.instance.routes.get("/anima-tools/lora/local")
async def lora_local_list_api(request):
    try:
        local_loras = [item["filename"] for item in scan_loras_with_info()]
        return web.json_response(local_loras)
    except Exception as e:
        print(f"[Anima Tools] Local LoRA List API error: {e}")
        return web.json_response([], status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/manifest")
async def lora_manifest_api(request):
    try:
        try:
            width = max(80, min(int(request.query.get("width", "320")), 1024))
        except (ValueError, TypeError):
            width = 320

        items = []
        for info in scan_loras_with_info():
            filename = info["filename"]
            abs_path = info["abs_path"]
            try:
                stat = os.stat(abs_path)
            except OSError:
                continue

            preview_file = find_companion_preview(abs_path)
            cache_key = get_preview_cache_key(abs_path, preview_file)
            metadata_status, meta_summary = read_lora_meta_summary(abs_path)
            items.append({
                "filename": filename,
                "display_name": meta_summary.get("name") or make_display_name(filename),
                "size": stat.st_size,
                "mtime": int(stat.st_mtime),
                "cache_key": cache_key,
                "thumb_url": f"/anima-tools/lora/local-preview?filename={urllib.parse.quote(filename)}&width={width}&v={cache_key}",
                "has_preview": bool(preview_file),
                "metadata_status": metadata_status,
                "meta_summary": meta_summary,
                "_preview_file": preview_file,
                "_abs_path": abs_path,
            })

        items.sort(key=lambda item: item["display_name"].lower())
        for item in items[:160]:
            preview_file = item.get("_preview_file")
            if preview_file and width > 0:
                _ensure_local_thumbnail_async(preview_file, width, delay=2.0)
            elif item.get("meta_summary", {}).get("preview_url"):
                _ensure_local_preview_download_async(item.get("_abs_path"), item["meta_summary"]["preview_url"], delay=3.0)
        for item in items:
            item.pop("_preview_file", None)
            item.pop("_abs_path", None)
        return web.json_response({
            "items": items,
            "count": len(items),
            "width": width,
            "generated_at": int(time.time())
        })
    except Exception as e:
        print(f"[Anima Tools] LoRA Manifest API error: {e}")
        return web.json_response({"items": [], "error": str(e)}, status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/search")
async def lora_search_api(request):
    try:
        query = request.query.get("query", "")
        tag = request.query.get("tag", "")
        category = request.query.get("category", "")
        sort = request.query.get("sort", "Highest Rated")
        cursor = request.query.get("cursor", "")
        limit_str = request.query.get("limit", "40")
        try:
            limit = int(limit_str)
        except ValueError:
            limit = 40
            
        result = search_civitai_loras(query=query, tag=tag, category=category, sort=sort, cursor=cursor, limit=limit)
        return web.json_response(result or {"items": [], "metadata": {}})
    except Exception as e:
        print(f"[Anima Tools] Search API error: {e}")
        return web.json_response({"items": [], "error": str(e)}, status=500)

@PromptServer.instance.routes.post("/anima-tools/lora/download")
async def lora_download_api(request):
    try:
        body = await request.json()
        version_id = body.get("version_id")
        download_url = body.get("download_url")
        filename = body.get("filename")
        metadata = body.get("metadata")
        
        if not version_id or not download_url or not filename:
            return web.json_response({"success": False, "error": "Missing parameters"}, status=400)

        parsed_url = urllib.parse.urlparse(str(download_url))
        if parsed_url.scheme != "https" or parsed_url.netloc.lower() not in ("civitai.com", "www.civitai.com", "civitai.red"):
            return web.json_response({"success": False, "error": "Only Civitai HTTPS downloads are supported"}, status=400)
            
        task_id = start_download_task(version_id, download_url, filename, metadata=metadata)
        return web.json_response({"success": True, "task_id": task_id})
    except Exception as e:
        print(f"[Anima Tools] Download API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


_LOCAL_METADATA_CACHE = {}

def get_info_from_civitai_by_hash(file_hash: str) -> dict | None:
    import urllib.request
    import json
    url = f"https://civitai.red/api/v1/model-versions/by-hash/{file_hash}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

@PromptServer.instance.routes.get("/anima-tools/lora/local-metadata")
async def lora_local_metadata_api(request):
    try:
        filename = request.query.get("filename", "")
        if not filename:
            return web.json_response({"success": False, "error": "Missing filename"}, status=400)
            
        filename = filename.replace("\\", "/")
        
        # Try metadata cache first
        if filename in _LOCAL_METADATA_CACHE:
            return web.json_response({"success": True, "metadata": _LOCAL_METADATA_CACHE[filename]})
            
        abs_path = resolve_lora_abs_path(filename)
            
        if abs_path and os.path.exists(abs_path):
            meta_path = os.path.splitext(abs_path)[0] + ".json"
            
            # 1. 优先读取已存在的本地 JSON 配置文件（支持旧版格式自动升级与自愈）
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta_data = json.load(f)
                    # 检查是否是包含 files、modelVersions 和 creator（作者）的新版完整格式，如果是则直接返回
                    if (isinstance(meta_data, dict) and 
                        "version" in meta_data and "files" in meta_data["version"] and 
                        "model" in meta_data and "modelVersions" in meta_data["model"] and
                        "creator" in meta_data["model"]):
                        _LOCAL_METADATA_CACHE[filename] = meta_data
                        return web.json_response({"success": True, "metadata": meta_data})
                    else:
                        print(f"[Anima Tools] Legacy local metadata found for {filename}, regenerating to fetch complete fields...")
                except Exception:
                    pass
                
            # 2. 如果不存在（或为旧版非完整格式），计算 SHA256 哈希值，从 Civitai 反向抓取元数据
            print(f"[Anima Tools] Resolving complete metadata for {filename}...")
            try:
                h = hashlib.sha256()
                with open(abs_path, 'rb') as f:
                    for chunk in iter(lambda: f.read(4096 * 1024), b''): # 4MB chunk
                        h.update(chunk)
                file_hash = h.hexdigest().upper()
                
                info = get_info_from_civitai_by_hash(file_hash)
                if info and "error" not in info:
                    # 二次查询模型完整元数据，获取作者 (creator) 及其它版本详情和高质量预览图
                    model_id = info.get("modelId")
                    full_model = None
                    if model_id:
                        try:
                            full_model = fetch_civitai_model(model_id)
                        except Exception:
                            full_model = None
                            
                    # 组装符合前端所需的全包元数据格式
                    version_info = {
                        "id": info.get("id"),
                        "name": info.get("name"),
                        "trainedWords": info.get("trainedWords", []),
                        "images": info.get("images", []),
                        "files": info.get("files", []),
                        "downloadUrl": info.get("downloadUrl", ""),
                        "description": info.get("description", "")
                    }
                    
                    if full_model and "error" not in full_model:
                        model_info = full_model.copy()
                        # 补全或覆盖 modelVersions
                        model_info["modelVersions"] = full_model.get("modelVersions", [version_info])
                    else:
                        model_info = info.get("model", {}).copy()
                        model_info["modelVersions"] = [version_info]
                        model_info["description"] = info.get("description", "")
                    
                    meta_data = {
                        "model": model_info,
                        "version": version_info
                    }
                    # 自动保存本地同名 JSON 伴随文件，后续便可秒开
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump(meta_data, f, indent=2, ensure_ascii=False)
                        
                    # 尝试自动补齐本地 LoRA 的封面图！这样之前没有封面图的也能自动显示 C 站封面
                    images = info.get("images", [])
                    if images:
                        preview_url = images[0].get("url")
                        if preview_url:
                            preview_ext = ".png"
                            if ".jpg" in preview_url.lower() or ".jpeg" in preview_url.lower():
                                preview_ext = ".jpg"
                            elif ".webp" in preview_url.lower():
                                preview_ext = ".webp"
                            
                            preview_path = os.path.splitext(abs_path)[0] + preview_ext
                            if not os.path.exists(preview_path):
                                # 后台多线程异步下载图片，防止阻塞 metadata 请求
                                threading.Thread(
                                    target=download_preview_image,
                                    args=(preview_url, preview_path),
                                    daemon=True
                                ).start()
                                
                    _LOCAL_METADATA_CACHE[filename] = meta_data
                    return web.json_response({"success": True, "metadata": meta_data})
            except Exception as ex:
                print(f"[Anima Tools] Auto-metadata recovery failed for {filename}: {ex}")
                
        return web.json_response({"success": False, "error": "Metadata not found"}, status=404)
    except Exception as e:
        print(f"[Anima Tools] Get Local Metadata API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


# 缩略图磁盘缓存目录，放在 user 下以便 ComfyUI 重启和插件升级后继续复用
_THUMB_CACHE_DIR = os.path.join(get_anima_tools_user_dir(), "thumb_cache")
_REMOTE_THUMB_CACHE_DIR = os.path.join(get_anima_tools_user_dir(), "remote_thumb_cache")
_LOCAL_THUMB_JOBS = set()
_LOCAL_THUMB_QUEUE = []
_LOCAL_THUMB_WORKER_ACTIVE = False
_LOCAL_THUMB_LOCK = threading.Lock()
_LOCAL_PREVIEW_DOWNLOAD_JOBS = set()
_LOCAL_PREVIEW_DOWNLOAD_QUEUE = []
_LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE = False
_LOCAL_PREVIEW_DOWNLOAD_LOCK = threading.Lock()

def _preview_extension_from_url(url: str) -> str:
    lower = (url or "").lower()
    if ".jpg" in lower or ".jpeg" in lower:
        return ".jpg"
    if ".webp" in lower:
        return ".webp"
    return ".png"

def _local_preview_download_worker(delay: float = 0.0) -> None:
    global _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE
    if delay > 0:
        time.sleep(delay)
    while True:
        with _LOCAL_PREVIEW_DOWNLOAD_LOCK:
            if not _LOCAL_PREVIEW_DOWNLOAD_QUEUE:
                _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE = False
                return
            image_url, preview_path, job_key = _LOCAL_PREVIEW_DOWNLOAD_QUEUE.pop(0)
        try:
            if not os.path.exists(preview_path):
                download_preview_image(image_url, preview_path)
        finally:
            with _LOCAL_PREVIEW_DOWNLOAD_LOCK:
                _LOCAL_PREVIEW_DOWNLOAD_JOBS.discard(job_key)

def _ensure_local_preview_download_async(abs_path: str, image_url: str, delay: float = 3.0) -> None:
    global _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE
    if not abs_path or not image_url or not image_url.lower().startswith(("http://", "https://")):
        return
    preview_path = os.path.splitext(abs_path)[0] + _preview_extension_from_url(image_url)
    if os.path.exists(preview_path):
        return
    job_key = f"{preview_path}:{image_url}"
    with _LOCAL_PREVIEW_DOWNLOAD_LOCK:
        if job_key in _LOCAL_PREVIEW_DOWNLOAD_JOBS:
            return
        _LOCAL_PREVIEW_DOWNLOAD_JOBS.add(job_key)
        _LOCAL_PREVIEW_DOWNLOAD_QUEUE.append((image_url, preview_path, job_key))
        if _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE:
            return
        _LOCAL_PREVIEW_DOWNLOAD_WORKER_ACTIVE = True
    threading.Thread(target=_local_preview_download_worker, args=(delay,), daemon=True).start()

def _thumbnail_cache_path(preview_file: str, target_width: int) -> str:
    stat = os.stat(preview_file)
    cache_key = hashlib.sha256(
        f"{os.path.abspath(preview_file)}|{int(stat.st_mtime)}|{stat.st_size}|{target_width}".encode("utf-8", errors="ignore")
    ).hexdigest()
    return os.path.join(_THUMB_CACHE_DIR, f"{cache_key}.webp")

def _get_thumbnail(preview_file: str, target_width: int, generate: bool = True) -> tuple[bytes, str] | None:
    """生成并缓存缩略图，返回 (图片bytes, content_type) 或 None"""
    if Image is None:
        return None

    # 视频文件不处理缩略图
    ext_lower = os.path.splitext(preview_file)[1].lower()
    if ext_lower in (".mp4", ".webm", ".gif"):
        return None

    # 检查磁盘缓存
    cache_path = _thumbnail_cache_path(preview_file, target_width)

    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return f.read(), "image/webp"
    if not generate:
        return None

    try:
        img = Image.open(preview_file)
        img = img.convert("RGB")
        if target_width > 0 and img.width > target_width:
            ratio = target_width / img.width
            new_size = (target_width, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="WEBP", quality=82)
        thumb_data = buf.getvalue()

        # 写入磁盘缓存
        os.makedirs(_THUMB_CACHE_DIR, exist_ok=True)
        with open(cache_path, "wb") as f:
            f.write(thumb_data)

        return thumb_data, "image/webp"
    except Exception as e:
        print(f"[Anima Tools] Thumbnail generation failed: {e}")
        return None

def _warm_local_thumbnail(preview_file: str, target_width: int) -> None:
    try:
        _get_thumbnail(preview_file, target_width, generate=True)
    finally:
        job_key = f"{preview_file}:{target_width}"
        with _LOCAL_THUMB_LOCK:
            _LOCAL_THUMB_JOBS.discard(job_key)

def _local_thumbnail_worker(delay: float = 0.0) -> None:
    global _LOCAL_THUMB_WORKER_ACTIVE
    if delay > 0:
        time.sleep(delay)
    while True:
        with _LOCAL_THUMB_LOCK:
            if not _LOCAL_THUMB_QUEUE:
                _LOCAL_THUMB_WORKER_ACTIVE = False
                return
            preview_file, target_width = _LOCAL_THUMB_QUEUE.pop(0)
        _warm_local_thumbnail(preview_file, target_width)

def _ensure_local_thumbnail_async(preview_file: str, target_width: int, delay: float = 0.0) -> None:
    global _LOCAL_THUMB_WORKER_ACTIVE
    if Image is None or target_width <= 0:
        return
    try:
        cache_path = _thumbnail_cache_path(preview_file, target_width)
        if os.path.exists(cache_path):
            return
    except Exception:
        return
    job_key = f"{preview_file}:{target_width}"
    with _LOCAL_THUMB_LOCK:
        if job_key in _LOCAL_THUMB_JOBS:
            return
        _LOCAL_THUMB_JOBS.add(job_key)
        _LOCAL_THUMB_QUEUE.append((preview_file, target_width))
        if _LOCAL_THUMB_WORKER_ACTIVE:
            return
        _LOCAL_THUMB_WORKER_ACTIVE = True
    threading.Thread(target=_local_thumbnail_worker, args=(delay,), daemon=True).start()

def _placeholder_svg_response(cache_control: str = "no-store") -> web.Response:
    svg_content = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>"
        "<rect width='100' height='100' fill='#222'/>"
        "<text x='50%' y='50%' font-size='10' fill='#666' dominant-baseline='middle' text-anchor='middle'>No Preview</text>"
        "</svg>"
    )
    return web.Response(body=svg_content, content_type="image/svg+xml", headers={"Cache-Control": cache_control})

_REMOTE_THUMB_JOBS = set()
_REMOTE_THUMB_LOCK = threading.Lock()

def _remote_thumb_cache_path(cache_key: str, width: int) -> str:
    safe_key = "".join(ch for ch in cache_key if ch.isalnum())[:80] or "remote"
    return os.path.join(_REMOTE_THUMB_CACHE_DIR, f"{safe_key}_{width}.webp")

def _download_remote_thumbnail(url: str, cache_path: str, width: int, job_key: str) -> None:
    try:
        if Image is None:
            return
        req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Anima-Tools/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()

        img = Image.open(BytesIO(data)).convert("RGB")
        if width > 0 and img.width > width:
            ratio = width / img.width
            img = img.resize((width, int(img.height * ratio)), Image.LANCZOS)

        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        tmp_path = cache_path + ".tmp"
        img.save(tmp_path, format="WEBP", quality=82)
        os.replace(tmp_path, cache_path)
    except Exception as e:
        print(f"[Anima Tools] Remote preview cache failed: {e}")
    finally:
        with _REMOTE_THUMB_LOCK:
            _REMOTE_THUMB_JOBS.discard(job_key)

@PromptServer.instance.routes.get("/anima-tools/lora/remote-preview")
async def lora_remote_preview_api(request):
    try:
        try:
            width = max(80, min(int(request.query.get("width", "320")), 1024))
        except (ValueError, TypeError):
            width = 320

        source_url = request.query.get("url", "").strip()
        url_hash = request.query.get("url_hash", "").strip()
        if source_url:
            cache_key = hashlib.sha256(source_url.encode("utf-8", errors="ignore")).hexdigest()
        else:
            cache_key = url_hash

        if not cache_key:
            return _placeholder_svg_response()

        cache_path = _remote_thumb_cache_path(cache_key, width)
        if os.path.exists(cache_path):
            resp = web.FileResponse(cache_path)
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp

        if source_url and source_url.lower().startswith(("http://", "https://")):
            if Image is None:
                raise web.HTTPFound(source_url)
            job_key = f"{cache_key}:{width}"
            with _REMOTE_THUMB_LOCK:
                if job_key not in _REMOTE_THUMB_JOBS:
                    _REMOTE_THUMB_JOBS.add(job_key)
                    threading.Thread(
                        target=_download_remote_thumbnail,
                        args=(source_url, cache_path, width, job_key),
                        daemon=True
                    ).start()

        return _placeholder_svg_response("no-store")
    except web.HTTPException:
        raise
    except Exception as e:
        print(f"[Anima Tools] Remote Preview API error: {e}")
        return _placeholder_svg_response()

@PromptServer.instance.routes.get("/anima-tools/lora/local-preview")
async def lora_local_preview_api(request):
    try:
        filename = request.query.get("filename", "")
        if not filename:
            return web.Response(status=400)
        
        # 解析目标缩略图宽度（默认不缩放以保持向后兼容）
        try:
            target_width = int(request.query.get("width", "0"))
        except (ValueError, TypeError):
            target_width = 0
            
        filename = filename.replace("\\", "/")
        abs_path = resolve_lora_abs_path(filename)
            
        if abs_path and os.path.exists(abs_path):
            preview_file = find_companion_preview(abs_path)
            if preview_file:
                immutable_cache = "public, max-age=31536000, immutable" if request.query.get("v") else "public, max-age=86400"
                if target_width > 0:
                    thumb = _get_thumbnail(preview_file, target_width, generate=False)
                    if thumb:
                        thumb_data, content_type = thumb
                        return web.Response(
                            body=thumb_data,
                            content_type=content_type,
                            headers={"Cache-Control": immutable_cache}
                        )
                resp = web.FileResponse(preview_file)
                resp.headers["Cache-Control"] = immutable_cache
                return resp
                    
        # 找不到本地预览图时，返回默认的 No Preview 占位图，状态设为 200，防止控制台大量 404 报错
        return _placeholder_svg_response("public, max-age=3600")
    except Exception as e:
        print(f"[Anima Tools] Local Preview API error: {e}")
        return web.Response(status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/download-status")
async def lora_download_status_api(request):
    try:
        task_id = request.query.get("task_id", "")
        if not task_id:
            from .anima_lora_api import get_all_download_jobs
            return web.json_response(get_all_download_jobs())
            
        status_info = get_download_job_status(task_id)
        if not status_info:
            return web.json_response({"status": "not_found"}, status=404)
        return web.json_response(status_info)
    except Exception as e:
        print(f"[Anima Tools] Download Status API error: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/anima-tools/lora/config")
async def lora_get_config_api(request):
    try:
        config = load_lora_config()
        config["resolved_save_dir"] = get_lora_save_dir()
        return web.json_response(config)
    except Exception as e:
        print(f"[Anima Tools] Get Config API error: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/anima-tools/lora/config")
async def lora_save_config_api(request):
    try:
        body = await request.json()
        config = load_lora_config()
        if "custom_lora_dir" in body:
            config["custom_lora_dir"] = body["custom_lora_dir"]
        if "civitai_api_key" in body:
            config["civitai_api_key"] = body["civitai_api_key"]
            
        success = save_lora_config(config)
        return web.json_response({"success": success, "resolved_save_dir": get_lora_save_dir()})
    except Exception as e:
        print(f"[Anima Tools] Save Config API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


def delete_local_lora_files(filename: str) -> bool:
    """Helper to delete a local LoRA model and its companion meta files."""
    try:
        # 统一将反斜杠替换为正斜杠，防止 Windows 路径转义解析错误
        filename = filename.replace("\\", "/")
        
        # Invalidate metadata cache
        _LOCAL_METADATA_CACHE.pop(filename, None)
        
        abs_path = resolve_lora_abs_path(filename)
            
        if not abs_path:
            return False
            
        abs_path = os.path.normpath(abs_path)
        
        if not os.path.exists(abs_path):
            # 如果主模型文件都不存在，我们也尝试看看有没有残留的伴随文件
            print(f"[Anima Tools] Model file {abs_path} not found, checking companion files...")
            
        # 1. 尝试删除 companion JSON metadata
        base_no_ext = os.path.splitext(abs_path)[0]
        meta_file = base_no_ext + ".json"
        deleted_any = False
        
        if os.path.exists(meta_file):
            try:
                os.remove(meta_file)
                print(f"[Anima Tools] Successfully deleted companion meta JSON: {meta_file}")
                deleted_any = True
            except Exception as e:
                print(f"[Anima Tools] Failed to delete companion meta JSON {meta_file}: {e}")
                
        # 2. 尝试删除 companion preview images (支持同名和带 .preview 后缀的预览图)
        preview_extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"]
        for ext in preview_extensions:
            for suffix in ["", ".preview"]:
                preview_file = base_no_ext + suffix + ext
                if os.path.exists(preview_file):
                    try:
                        os.remove(preview_file)
                        print(f"[Anima Tools] Successfully deleted preview image: {preview_file}")
                        deleted_any = True
                    except Exception as e:
                        print(f"[Anima Tools] Failed to delete preview image {preview_file}: {e}")
                    
        # 3. 尝试删除主模型文件
        model_deleted = False
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
                print(f"[Anima Tools] Successfully deleted main model file: {abs_path}")
                model_deleted = True
            except Exception as e:
                print(f"[Anima Tools] Failed to delete main model file {abs_path} (it might be locked or in-use by ComfyUI): {e}")
                
        return model_deleted or deleted_any
    except Exception as e:
        print(f"[Anima Tools] Error deleting local LoRA files: {e}")
        return False


@PromptServer.instance.routes.post("/anima-tools/lora/delete-local")
async def lora_delete_local_api(request):
    try:
        body = await request.json()
        filename = body.get("filename", "")
        if not filename:
            return web.json_response({"success": False, "error": "Missing filename"}, status=400)
            
        success = delete_local_lora_files(filename)
        if success:
            # Refresh local lists in memory if cached, though ComfyUI usually handles dynamically
            return web.json_response({"success": True})
        else:
            return web.json_response({"success": False, "error": "File not found or failed to delete"}, status=404)
    except Exception as e:
        print(f"[Anima Tools] Delete Local API error: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


