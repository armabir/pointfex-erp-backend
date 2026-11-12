import type { WorkspaceId } from '../config/workspaces'

export type UiDensity = 'comfortable' | 'compact'

export interface UserPreferences {
  pinnedRoutes: string[]
  widgetOrder: string[]
  hiddenWidgetIds: string[]
  density: UiDensity
  defaultWorkspace: WorkspaceId
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  pinnedRoutes: ['inbox', 'tasks'],
  widgetOrder: [],
  hiddenWidgetIds: [],
  density: 'comfortable',
  defaultWorkspace: 'home',
}

function getPrefsKey(userId: string): string {
  return `pointfex_prefs_${userId}`
}

export function loadUserPreferences(userId?: string): UserPreferences {
  if (!userId || typeof localStorage === 'undefined') return DEFAULT_USER_PREFERENCES
  try {
    const raw = localStorage.getItem(getPrefsKey(userId))
    if (!raw) return DEFAULT_USER_PREFERENCES
    const parsed = JSON.parse(raw)
    return {
      pinnedRoutes: Array.isArray(parsed.pinnedRoutes)
        ? parsed.pinnedRoutes
        : DEFAULT_USER_PREFERENCES.pinnedRoutes,
      widgetOrder: Array.isArray(parsed.widgetOrder) ? parsed.widgetOrder : [],
      hiddenWidgetIds: Array.isArray(parsed.hiddenWidgetIds) ? parsed.hiddenWidgetIds : [],
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      defaultWorkspace: parsed.defaultWorkspace || 'home',
    }
  } catch {
    return DEFAULT_USER_PREFERENCES
  }
}

export function saveUserPreferences(userId: string | undefined, prefs: UserPreferences): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(getPrefsKey(userId), JSON.stringify(prefs))
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.density = prefs.density
    }
  } catch {
    // ignore storage quota errors
  }
}

export function getClockInStateKey(userId: string): string {
  return `pointfex_clock_${userId}`
}

