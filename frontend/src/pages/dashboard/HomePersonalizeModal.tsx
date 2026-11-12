import { ArrowDown, ArrowUp, Eye, EyeOff, Pin, SlidersHorizontal } from 'lucide-react'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import type { DashboardWidgetDef } from '../../dashboard/widgets'
import type { NavRegistryItem } from '../../config/nav-registry'
import { WORKSPACES, type WorkspaceId } from '../../config/workspaces'
import type { UiDensity, UserPreferences } from '../../utils/user-prefs'

export interface HomePersonalizeModalProps {
  isOpen: boolean
  onClose: () => void
  prefs: UserPreferences
  onChangePrefs: (next: UserPreferences) => void
  availableWidgets: DashboardWidgetDef[]
  availablePages: NavRegistryItem[]
  availableWorkspaces: Array<{ id: WorkspaceId; label: string }>
}

export function HomePersonalizeModal({
  isOpen,
  onClose,
  prefs,
  onChangePrefs,
  availableWidgets,
  availablePages,
  availableWorkspaces,
}: HomePersonalizeModalProps) {
  const orderedWidgets = (() => {
    const orderMap = new Map(prefs.widgetOrder.map((id, idx) => [id, idx]))
    return [...availableWidgets].sort((a, b) => {
      const ia = orderMap.get(a.id) ?? 999
      const ib = orderMap.get(b.id) ?? 999
      return ia - ib
    })
  })()

  const togglePin = (route: string) => {
    const pinned = prefs.pinnedRoutes.includes(route)
      ? prefs.pinnedRoutes.filter((r) => r !== route)
      : [...prefs.pinnedRoutes, route]
    onChangePrefs({ ...prefs, pinnedRoutes: pinned })
  }

  const toggleWidgetHidden = (id: string) => {
    const hidden = prefs.hiddenWidgetIds.includes(id)
      ? prefs.hiddenWidgetIds.filter((w) => w !== id)
      : [...prefs.hiddenWidgetIds, id]
    onChangePrefs({ ...prefs, hiddenWidgetIds: hidden })
  }

  const moveWidget = (id: string, dir: -1 | 1) => {
    const ids = orderedWidgets.map((w) => w.id)
    const idx = ids.indexOf(id)
    const nextIdx = idx + dir
    if (idx < 0 || nextIdx < 0 || nextIdx >= ids.length) return
    const copy = [...ids]
    const [removed] = copy.splice(idx, 1)
    copy.splice(nextIdx, 0, removed)
    onChangePrefs({ ...prefs, widgetOrder: copy })
  }

  const setDensity = (density: UiDensity) => {
    onChangePrefs({ ...prefs, density })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Personalize My Day" maxWidth="max-w-xl">
      <div className="space-y-5 text-[13px]">
        {/* Density + Default Workspace */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Layout Density
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['comfortable', 'compact'] as UiDensity[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  className={`py-2 px-3 rounded-[var(--radius-control)] border text-[12px] font-medium capitalize cursor-pointer ${
                    prefs.density === d
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Default Landing Workspace
            </label>
            <select
              value={prefs.defaultWorkspace}
              onChange={(e) =>
                onChangePrefs({ ...prefs, defaultWorkspace: e.target.value as WorkspaceId })
              }
              className="w-full px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-[13px]"
            >
              {(availableWorkspaces.length > 0 ? availableWorkspaces : WORKSPACES).map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pin / Favorite Pages */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
            <Pin className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Pinned Quick-Access Pages</span>
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 p-2.5 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)]">
            {availablePages.map((page) => {
              const pinned = prefs.pinnedRoutes.includes(page.route)
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => togglePin(page.route)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-medium cursor-pointer border ${
                    pinned
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  {pinned ? '★ ' : ''}
                  {page.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Reorder / Hide Widgets */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Home Widgets (Order &amp; Visibility)</span>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {orderedWidgets.map((w, idx) => {
              const hidden = prefs.hiddenWidgetIds.includes(w.id)
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)]"
                >
                  <span
                    className={`text-[13px] font-medium truncate ${
                      hidden ? 'text-[var(--muted)] line-through' : 'text-[var(--text)]'
                    }`}
                  >
                    {w.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveWidget(w.id, -1)}
                      className="p-1.5 rounded hover:bg-[var(--surface-muted)] disabled:opacity-30 cursor-pointer"
                      aria-label={`Move ${w.title} up`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedWidgets.length - 1}
                      onClick={() => moveWidget(w.id, 1)}
                      className="p-1.5 rounded hover:bg-[var(--surface-muted)] disabled:opacity-30 cursor-pointer"
                      aria-label={`Move ${w.title} down`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWidgetHidden(w.id)}
                      className="p-1.5 rounded hover:bg-[var(--surface-muted)] cursor-pointer text-[var(--muted)] hover:text-[var(--text)]"
                      aria-label={hidden ? `Show ${w.title}` : `Hide ${w.title}`}
                    >
                      {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}

