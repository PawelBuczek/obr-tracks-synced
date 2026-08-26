export const BUILT_IN_TAGS = [
  "ambient",
  "battle",
  "calm",
  "focus",
  "action",
  "dark",
  "mysterious",
  "atmospheric",
  "relaxing",
  "intense",
  "meditation",
  "sleep",
  "combat",
  "energetic",
  "suspenseful",
  "hopeful",
  "uplifting",
  "cinematic",
  "dreamy",
  "eerie",
  "dramatic",
  "playful",
  "melancholy",
  "gentle",
  "tense",
  "exciting",
  "soothing",
  "epic",
  "adventurous",
  "romantic",
  "moody",
  "fun",
  "chaotic",
  "serene",
  "upbeat",
  "haunting",
  "glowing",
  "nostalgic",
  "futuristic",
  "grounded",
  "mellow",
  "lively",
  "steady",
  "heavy",
  "light",
  "gritty",
  "vibrant",
  "quiet",
  "wild",
  "emotional",
  "distant",
  "warm",
  "cool",
  "airy",
  "thunderous",
  "lush",
  "crisp",
  "organic",
  "mechanical",
  "whimsical",
  "heroic",
  "minimal",
  "euphoric",
  "curious",
  "resolute",
  "reflective",
  "chill",
  "restless",
  "precise",
  "spacious",
  "pulsing",
  "neon",
  "retro",
  "classic",
  "modern",
  "folk",
  "electronic",
  "soft",
  "urgent",
  "breezy",
  "joyful",
  "layered",
  "rhythmic",
  "timeless",
  "delicate",
] as const

export const BUILT_IN_TAG_ID_MIN = 0
export const BUILT_IN_TAG_ID_MAX = BUILT_IN_TAGS.length - 1
export const CUSTOM_TAG_ID_MIN = 85
export const CUSTOM_TAG_ID_MAX = 99
export const MAX_TAGS_PER_TRACK = 5
export const MAX_CUSTOM_TAG_NAME_LENGTH = 15

export type BuiltInTagName = (typeof BUILT_IN_TAGS)[number]

export type CustomTagMap = Record<string, string>

export function isValidTagId(id: number): boolean {
  return (
    Number.isInteger(id) &&
    ((id >= BUILT_IN_TAG_ID_MIN && id <= BUILT_IN_TAG_ID_MAX) ||
      (id >= CUSTOM_TAG_ID_MIN && id <= CUSTOM_TAG_ID_MAX))
  )
}

export function isCustomTagId(id: number): boolean {
  return Number.isInteger(id) && id >= CUSTOM_TAG_ID_MIN && id <= CUSTOM_TAG_ID_MAX
}

export function normalizeCustomTagName(name: string): string {
  return name.trim()
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase()
}

export function getBuiltinTagId(name: string): number | undefined {
  const normalized = normalizeTagName(name)
  const index = BUILT_IN_TAGS.indexOf(normalized as BuiltInTagName)
  return index >= 0 ? index : undefined
}

export function getBuiltinTagName(id: number): string | undefined {
  if (!Number.isInteger(id) || id < 0 || id >= BUILT_IN_TAGS.length) {
    return undefined
  }

  return BUILT_IN_TAGS[id]
}

export function getCustomTagName(id: number, customTags: CustomTagMap = {}): string | undefined {
  if (!isCustomTagId(id)) {
    return undefined
  }

  const key = String(id)
  return customTags[key] ? customTags[key].trim() : undefined
}

export function resolveTagId(
  tag: number | string,
  customTags: CustomTagMap = {},
): number | undefined {
  if (typeof tag === "number") {
    if (getBuiltinTagName(tag)) {
      return tag
    }

    if (isCustomTagId(tag) && getCustomTagName(tag, customTags)) {
      return tag
    }

    return undefined
  }

  const normalized = normalizeTagName(tag)
  const builtinId = getBuiltinTagId(normalized)
  if (builtinId !== undefined) {
    return builtinId
  }

  const customId = Object.entries(customTags).find(([, name]) => {
    return normalizeCustomTagName(name).toLowerCase() === normalized
  })?.[0]

  return customId !== undefined ? Number(customId) : undefined
}

export function resolveTagName(tag: number | string, customTags: CustomTagMap = {}): string {
  if (typeof tag === "number") {
    if (getBuiltinTagName(tag)) {
      return getBuiltinTagName(tag)!
    }

    if (isCustomTagId(tag)) {
      return getCustomTagName(tag, customTags) ?? String(tag)
    }

    return String(tag)
  }

  return normalizeTagName(tag)
}

export function formatTrackTag(tag: number | string, customTags: CustomTagMap = {}): string {
  return resolveTagName(tag, customTags)
}
