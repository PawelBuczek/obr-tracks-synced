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

export type BuiltInTagName = (typeof BUILT_IN_TAGS)[number]

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

export function resolveTagId(tag: number | string): number | undefined {
  if (typeof tag === "number") {
    return getBuiltinTagName(tag) ? tag : undefined
  }

  return getBuiltinTagId(tag)
}

export function resolveTagName(tag: number | string): string {
  if (typeof tag === "number") {
    return getBuiltinTagName(tag) ?? String(tag)
  }

  return normalizeTagName(tag)
}

export function formatTrackTag(tag: number | string): string {
  return resolveTagName(tag)
}
