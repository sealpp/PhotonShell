import { computed, unref, type MaybeRef, type Ref } from 'vue'

export function getPortalTarget(owner?: Element | null): HTMLElement | undefined {
  if (owner?.ownerDocument) return owner.ownerDocument.body
  if (typeof document !== 'undefined') return document.body
  return undefined
}

export function usePortalTarget(owner?: MaybeRef<Element | null | undefined>): Ref<HTMLElement | undefined> {
  return computed(() => getPortalTarget(owner ? unref(owner) : undefined))
}
