import type { InjectionKey, Ref } from 'vue'

export const PortalKey: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('boss-helper-portal')
