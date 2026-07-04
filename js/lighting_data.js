const lightingData = [
  {
    "id": "lighting_direction_0001",
    "name": "Backlighting",
    "name_zh": "逆光",
    "tags": "backlighting, strong light behind the character, bright rim around silhouette, face partially in shadow,",
    "tags_zh": "逆光, 背光, 剪影",
    "categories": ["光源方向 (Light Direction)"],
    "traits": ["backlighting", "silhouette", "backlight"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_direction_0002",
    "name": "Rim Lighting",
    "name_zh": "轮廓光",
    "tags": "rim lighting, thin glowing edge light around hair and shoulders, dark front lighting,",
    "tags_zh": "轮廓光, 边缘光, 边光",
    "categories": ["光源方向 (Light Direction)"],
    "traits": ["rim lighting", "edge light", "highlight"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_direction_0003",
    "name": "Side Lighting",
    "name_zh": "侧光",
    "tags": "side lighting, key light from the left side only, one side of face in shadow,",
    "tags_zh": "侧光, 侧面照明, 侧向光",
    "categories": ["光源方向 (Light Direction)"],
    "traits": ["side lighting", "sidelighting", "contrast"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_direction_0004",
    "name": "Underlighting",
    "name_zh": "底光",
    "tags": "underlighting, light source below the chin, upward shadows on face, eerie stage lighting,",
    "tags_zh": "底光, 下方打光, 从下方照亮",
    "categories": ["光源方向 (Light Direction)"],
    "traits": ["underlighting", "from below", "dramatic"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_direction_0005",
    "name": "Overhead Lighting",
    "name_zh": "顶光",
    "tags": "overhead lighting, top-down spotlight, shadows under eyes and nose, bright head and shoulders,",
    "tags_zh": "顶光, 上方光, 硬阴影",
    "categories": ["光源方向 (Light Direction)"],
    "traits": ["overhead lighting", "top light", "shadows"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_quality_0001",
    "name": "Soft Lighting",
    "name_zh": "柔光",
    "tags": "soft diffused lighting, large softbox light, gentle low contrast shadows,",
    "tags_zh": "柔光, 柔和光线, 柔和阴影",
    "categories": ["光线质感 (Light Quality)"],
    "traits": ["soft lighting", "soft light", "gentle"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_quality_0002",
    "name": "Hard Lighting",
    "name_zh": "硬光",
    "tags": "hard direct lighting, sharp cast shadows, crisp shadow edges,",
    "tags_zh": "硬光, 强光, 锐利阴影",
    "categories": ["光线质感 (Light Quality)"],
    "traits": ["hard lighting", "sharp shadows", "contrast"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_quality_0003",
    "name": "Dramatic Lighting",
    "name_zh": "戏剧光",
    "tags": "dramatic high contrast lighting, deep black shadows, bright focused highlights,",
    "tags_zh": "戏剧光, 高对比, 深阴影",
    "categories": ["光线质感 (Light Quality)"],
    "traits": ["dramatic lighting", "high contrast", "deep shadows"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_quality_0004",
    "name": "Cinematic Lighting",
    "name_zh": "电影感光线",
    "tags": "cinematic film lighting, moody key light, controlled shadows, movie still,",
    "tags_zh": "电影感光线, 电影布光, 戏剧阴影",
    "categories": ["光线质感 (Light Quality)"],
    "traits": ["cinematic lighting", "film lighting", "dramatic"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_quality_0005",
    "name": "Chiaroscuro",
    "name_zh": "明暗对照",
    "tags": "chiaroscuro lighting, strong light-dark separation, large areas of darkness,",
    "tags_zh": "明暗对照, 暗调主义, 高对比",
    "categories": ["光线质感 (Light Quality)"],
    "traits": ["chiaroscuro", "tenebrism", "contrast"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_effect_0001",
    "name": "Volumetric Lighting",
    "name_zh": "体积光",
    "tags": "volumetric lighting, visible light beams through haze, atmospheric dust,",
    "tags_zh": "体积光, 光束, 空气感",
    "categories": ["光效 (Light Effect)"],
    "traits": ["volumetric lighting", "light rays", "atmosphere"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_effect_0002",
    "name": "God Rays",
    "name_zh": "丁达尔光",
    "tags": "god rays, sunlight beams from above, bright shafts of light through air,",
    "tags_zh": "神圣光束, 云隙光, 光束",
    "categories": ["光效 (Light Effect)"],
    "traits": ["god rays", "crepuscular rays", "light rays"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_effect_0003",
    "name": "Lens Flare",
    "name_zh": "镜头光晕",
    "tags": "lens flare, strong light hitting camera lens, rainbow flare streaks,",
    "tags_zh": "镜头光晕, 漏光, 泛光",
    "categories": ["光效 (Light Effect)"],
    "traits": ["lens flare", "light leak", "bloom"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_effect_0004",
    "name": "Bloom",
    "name_zh": "泛光",
    "tags": "heavy bloom, glowing highlights, overexposed light glow,",
    "tags_zh": "泛光, 发光, 光辉",
    "categories": ["光效 (Light Effect)"],
    "traits": ["bloom", "glow", "glowing"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_effect_0005",
    "name": "Bokeh",
    "name_zh": "散景",
    "tags": "bokeh lights, out-of-focus background light circles, shallow depth of field,",
    "tags_zh": "散景, 背景虚化, 景深",
    "categories": ["光效 (Light Effect)"],
    "traits": ["bokeh", "blur", "depth of field"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_time_0001",
    "name": "Golden Hour",
    "name_zh": "黄金时刻",
    "tags": "golden hour lighting, low warm sunset sun, long orange shadows,",
    "tags_zh": "黄金时刻, 日落, 暖光",
    "categories": ["时间氛围 (Time & Mood)"],
    "traits": ["golden hour", "sunset", "warm"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_time_0002",
    "name": "Blue Hour",
    "name_zh": "蓝调时刻",
    "tags": "blue hour lighting, deep blue dusk ambient light, cool twilight mood,",
    "tags_zh": "蓝调时刻, 黄昏, 冷光",
    "categories": ["时间氛围 (Time & Mood)"],
    "traits": ["blue hour", "dusk", "cool"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_time_0003",
    "name": "Moonlight",
    "name_zh": "月光",
    "tags": "moonlight scene, cold blue moonlight, dark night shadows,",
    "tags_zh": "月光, 夜晚, 冷色光",
    "categories": ["时间氛围 (Time & Mood)"],
    "traits": ["moonlight", "night", "cool"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_time_0004",
    "name": "Sunlight",
    "name_zh": "阳光",
    "tags": "direct sunlight, bright midday sun, clear strong natural shadows,",
    "tags_zh": "阳光, 日光, 自然光",
    "categories": ["时间氛围 (Time & Mood)"],
    "traits": ["sunlight", "natural", "day"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_time_0005",
    "name": "Dappled Sunlight",
    "name_zh": "斑驳阳光",
    "tags": "dappled sunlight, leaf shadows across face and clothes, broken sunlight pattern,",
    "tags_zh": "斑驳阳光, 树影, 阳光",
    "categories": ["时间氛围 (Time & Mood)"],
    "traits": ["dappled sunlight", "tree shadow", "sunlight"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_color_0001",
    "name": "Neon Lighting",
    "name_zh": "霓虹光",
    "tags": "neon lighting, vivid magenta and cyan neon signs, cyberpunk color cast,",
    "tags_zh": "霓虹光, 霓虹灯, 赛博朋克",
    "categories": ["色彩氛围 (Color Mood)"],
    "traits": ["neon lighting", "cyberpunk", "colorful"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_color_0002",
    "name": "Colored Lighting",
    "name_zh": "彩色光",
    "tags": "colored gel lighting, split red and blue lights on opposite sides,",
    "tags_zh": "彩色光, 彩色照明, 色彩光线",
    "categories": ["色彩氛围 (Color Mood)"],
    "traits": ["colored lighting", "colorful", "mood"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_color_0003",
    "name": "Warm Lighting",
    "name_zh": "暖色光",
    "tags": "warm orange lamp light, cozy amber indoor lighting, soft warm shadows,",
    "tags_zh": "暖色光, 暖光, 橙色光",
    "categories": ["色彩氛围 (Color Mood)"],
    "traits": ["warm lighting", "orange", "cozy"],
    "folder": "images",
    "preview": ""
  },
  {
    "id": "lighting_color_0004",
    "name": "Cool Lighting",
    "name_zh": "冷色光",
    "tags": "cool blue lighting, cold cyan ambient light, pale blue shadows,",
    "tags_zh": "冷色光, 蓝色光, 寒冷光线",
    "categories": ["色彩氛围 (Color Mood)"],
    "traits": ["cool lighting", "blue", "cold"],
    "folder": "images",
    "preview": ""
  }
];

if (typeof window !== "undefined") {
  window.lightingData = lightingData;
}

export { lightingData };
