import { Metadata } from "@owlbear-rodeo/sdk"
import {
  CUSTOM_TAG_ID_MAX,
  CUSTOM_TAG_ID_MIN,
  CustomTagMap,
  getBuiltinTagId,
  MAX_CUSTOM_TAG_NAME_LENGTH,
  isCustomTagId,
  normalizeCustomTagName,
} from "../../domain/tags"
import { Track } from "../../domain/track"
import { updateMetadataWithCurrent } from "../../infra/metadataHelper"
import { customTagsPath, encodeLibrary, extractCustomTags, extractLibrary, libraryPath } from "../metadataSchema"

export type CustomTagRejectionReason =
  | "duplicate-name"
  | "name-too-long"
  | "slot-full"
  | "empty-name"
  | "not-found"
  | "invalid-id"

export interface CustomTagRejection {
  reason: CustomTagRejectionReason
  count: number
}

export interface CustomTagLifecycleOutcome {
  changed: boolean
  customTags: CustomTagMap
  library: Track[]
  rejections?: CustomTagRejection[]
}

function setRejection(
  rejections: CustomTagRejection[],
  reason: CustomTagRejectionReason,
): CustomTagRejection[] {
  const existing = rejections.find(entry => entry.reason === reason)
  if (existing) {
    existing.count += 1
    return rejections
  }

  return [...rejections, { reason, count: 1 }]
}

function hasDuplicateCustomTagName(
  name: string,
  customTags: CustomTagMap,
  skipId?: number,
): boolean {
  const normalized = normalizeCustomTagName(name).toLowerCase()

  if (getBuiltinTagId(normalized) !== undefined) {
    return true
  }

  return Object.entries(customTags).some(([rawId, existingName]) => {
    const id = Number(rawId)
    if (skipId !== undefined && id === skipId) {
      return false
    }

    return normalizeCustomTagName(existingName).toLowerCase() === normalized
  })
}

function getNextCustomTagId(customTags: CustomTagMap): number | undefined {
  for (let id = CUSTOM_TAG_ID_MIN; id <= CUSTOM_TAG_ID_MAX; id += 1) {
    if (!(String(id) in customTags)) {
      return id
    }
  }

  return undefined
}

function withoutCustomTagId(tags: Array<number | string>, idToRemove: number): Array<number | string> {
  return tags.filter(tag => !(typeof tag === "number" && tag === idToRemove))
}

export async function createCustomTag(
  name: string,
): Promise<CustomTagLifecycleOutcome> {
  let outcome: CustomTagLifecycleOutcome = {
    changed: false,
    customTags: {},
    library: [],
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const library = extractLibrary(current)
    const currentCustomTags = extractCustomTags(current)
    const trimmed = normalizeCustomTagName(name)
    const rejections: CustomTagRejection[] = []

    if (!trimmed) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "empty-name"),
      }
      return undefined
    }

    if (trimmed.length > MAX_CUSTOM_TAG_NAME_LENGTH) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "name-too-long"),
      }
      return undefined
    }

    if (hasDuplicateCustomTagName(trimmed, currentCustomTags)) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "duplicate-name"),
      }
      return undefined
    }

    const id = getNextCustomTagId(currentCustomTags)
    if (id === undefined) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "slot-full"),
      }
      return undefined
    }

    const nextCustomTags = {
      ...currentCustomTags,
      [String(id)]: trimmed,
    }

    outcome = {
      changed: true,
      customTags: nextCustomTags,
      library,
    }

    return {
      [customTagsPath]: nextCustomTags,
    }
  })

  return outcome
}

export async function renameCustomTag(
  id: number,
  name: string,
): Promise<CustomTagLifecycleOutcome> {
  let outcome: CustomTagLifecycleOutcome = {
    changed: false,
    customTags: {},
    library: [],
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const library = extractLibrary(current)
    const currentCustomTags = extractCustomTags(current)
    const rejections: CustomTagRejection[] = []

    if (!isCustomTagId(id) || !(String(id) in currentCustomTags)) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "not-found"),
      }
      return undefined
    }

    const trimmed = normalizeCustomTagName(name)
    if (!trimmed) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "empty-name"),
      }
      return undefined
    }

    if (trimmed.length > MAX_CUSTOM_TAG_NAME_LENGTH) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "name-too-long"),
      }
      return undefined
    }

    if (hasDuplicateCustomTagName(trimmed, currentCustomTags, id)) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library,
        rejections: setRejection(rejections, "duplicate-name"),
      }
      return undefined
    }

    const nextCustomTags = {
      ...currentCustomTags,
      [String(id)]: trimmed,
    }

    outcome = {
      changed: true,
      customTags: nextCustomTags,
      library,
    }

    return {
      [customTagsPath]: nextCustomTags,
    }
  })

  return outcome
}

export async function deleteCustomTag(
  id: number,
): Promise<CustomTagLifecycleOutcome> {
  let outcome: CustomTagLifecycleOutcome = {
    changed: false,
    customTags: {},
    library: [],
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const currentCustomTags = extractCustomTags(current)
    const rejections: CustomTagRejection[] = []

    if (!isCustomTagId(id) || !(String(id) in currentCustomTags)) {
      outcome = {
        changed: false,
        customTags: currentCustomTags,
        library: currentLibrary,
        rejections: setRejection(rejections, "not-found"),
      }
      return undefined
    }

    const nextCustomTags = { ...currentCustomTags }
    delete nextCustomTags[String(id)]

    const nextLibrary = currentLibrary.map(track => ({
      ...track,
      tags: withoutCustomTagId(track.tags, id),
    }))

    outcome = {
      changed: true,
      customTags: nextCustomTags,
      library: nextLibrary,
    }

    return {
      [libraryPath]: encodeLibrary(nextLibrary),
      [customTagsPath]: Object.keys(nextCustomTags).length > 0 ? nextCustomTags : undefined,
    }
  })

  return outcome
}
