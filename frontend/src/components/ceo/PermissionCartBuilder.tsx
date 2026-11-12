import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Sparkles,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { WORKSPACES } from '../../config/workspaces'
import {
  PERMISSION_PACKS,
  buildRolePlainSummary,
  type PermissionPack,
} from '../../config/permission-packs'
import { isPermissionMfaRequiredEveryTime } from '../../config/sensitive-actions'
import { getPermissionDisplay } from '../../utils/permission-dictionary'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { SecurityConfirmModal } from '../common/SecurityConfirmModal'

export interface CartPermissionItem {
  id: string
  code: string
  resource: string
  action: string
  module: string
  name?: string | null
  description: string
  isSensitive: boolean
  isCritical?: boolean
  category?: {
    code: string
    name: string
    domains: string[]
    displayOrder: number
  } | null
}

const DOMAIN_WILDCARDS = [
  'admin:*',
  'hr:*',
  'finance:*',
  'engineering:*',
  'product:*',
  'sales:*',
  'ops:*',
] as const

const SCOPE_OPTIONS = [
  { id: 'SELF', label: 'Self only', hint: 'Only records owned by or assigned to the user' },
  { id: 'SQUAD', label: 'Squad', hint: 'Records within the user’s assigned squad(s)' },
  { id: 'DEPARTMENT', label: 'Department', hint: 'Records across the user’s department' },
  { id: 'PROJECT', label: 'Project', hint: 'Records scoped to assigned projects' },
  { id: 'ORG', label: 'Organization-wide', hint: 'All company records permitted by selected packs' },
] as const

export interface CartRolePreset {
  id: string
  slug: string
  name: string
  rolePermissions: Array<{ permission: { code: string } }>
}

interface PermissionCartBuilderProps {
  permissions: CartPermissionItem[]
  existingRoles: CartRolePreset[]
  onRoleCreated: (createdRole: any) => Promise<void> | void
}

export function PermissionCartBuilder({
  permissions,
  existingRoles,
  onRoleCreated,
}: PermissionCartBuilderProps) {
  const { showToast } = useApp()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [templateRoleId, setTemplateRoleId] = useState('')
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())
  const [selectedWildcards, setSelectedWildcards] = useState<Set<string>>(new Set())
  const [defaultScope, setDefaultScope] = useState<(typeof SCOPE_OPTIONS)[number]['id']>('SQUAD')
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleLoadPreset = (roleId: string) => {
    setTemplateRoleId(roleId)
    if (!roleId) return
    const found = existingRoles.find((r) => r.id === roleId)
    if (!found) return
    setSelectedCodes(new Set(found.rolePermissions.map((rp) => rp.permission.code)))
    showToast(`Loaded "${found.name}" capabilities as starting point.`, 'info')
  }

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const isPackSelected = (pack: PermissionPack) => pack.codes.every((c) => selectedCodes.has(c))
  const isPackPartial = (pack: PermissionPack) =>
    pack.codes.some((c) => selectedCodes.has(c)) && !isPackSelected(pack)

  const togglePack = (pack: PermissionPack) => {
    const selected = isPackSelected(pack)
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      for (const code of pack.codes) {
        if (selected) next.delete(code)
        else next.add(code)
      }
      return next
    })
  }

  const packsByWorkspace = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return WORKSPACES.map((ws) => {
      const packs = PERMISSION_PACKS.filter((p) => p.workspace === ws.id).filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.codes.some((c) => c.toLowerCase().includes(q)),
      )
      return { workspace: ws, packs }
    }).filter((g) => g.packs.length > 0)
  }, [searchQuery])

  const groupedByModule = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const map = new Map<
      string,
      { code: string; name: string; order: number; items: CartPermissionItem[] }
    >()
    for (const p of permissions) {
      const display = getPermissionDisplay(p.code, p.description)
      if (
        q &&
        !p.code.toLowerCase().includes(q) &&
        !display.label.toLowerCase().includes(q) &&
        !(p.name || '').toLowerCase().includes(q)
      ) {
        continue
      }
      const modCode = p.category?.code || p.module || '00'
      const modName = p.category?.name || p.module
      const order = p.category?.displayOrder ?? 99
      if (!map.has(modCode)) map.set(modCode, { code: modCode, name: modName, order, items: [] })
      map.get(modCode)!.items.push(p)
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order)
  }, [permissions, searchQuery])

  const selectedCriticalCodes = useMemo(() => {
    const criticalSet = new Set(permissions.filter((p) => p.isCritical).map((p) => p.code))
    return Array.from(selectedCodes).filter((c) => criticalSet.has(c))
  }, [permissions, selectedCodes])

  const plainSummary = useMemo(() => buildRolePlainSummary(selectedCodes), [selectedCodes])

  const executeCreateRole = async () => {
    setIsSubmitting(true)
    try {
      const scopeNote = `Default scope: ${defaultScope}.`
      const desc = roleDesc.trim() ? `${roleDesc.trim()} (${scopeNote})` : scopeNote
      const created = await erpApi.createRole({
        name: roleName.trim(),
        description: desc,
        permissionCodes: Array.from(selectedCodes),
        wildcards: Array.from(selectedWildcards),
      })
      setIsConfirmOpen(false)
      setRoleName('')
      setRoleDesc('')
      setTemplateRoleId('')
      setSelectedCodes(new Set())
      setSelectedWildcards(new Set())
      setStep(1)
      showToast(`Role "${created.name}" created with ${selectedCodes.size} capabilities.`, 'success')
      await onRoleCreated(created)
    } catch (err: any) {
      showToast(err?.message || 'Unable to save new role', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 4-Step Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { num: 1 as const, title: '1. Template & Name' },
          { num: 2 as const, title: '2. Capability Packs' },
          { num: 3 as const, title: '3. Default Scope' },
          { num: 4 as const, title: '4. Review & Save' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num)}
            className={`px-3 py-2.5 rounded-[var(--radius-control)] border text-left text-[12px] font-semibold cursor-pointer transition-colors ${
              step === s.num
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : step > s.num
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30'
                  : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Step 1: Pick Template & Role Name */}
      {step === 1 && (
        <Card
          title="Step 1 — Start from a template or existing role"
          icon={Sparkles}
          subtitle="Name the role clearly in plain English and optionally clone a baseline preset."
        >
          <div className="space-y-4 max-w-xl text-[13px]">
            <div>
              <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                Starting Template (Optional)
              </label>
              <select
                value={templateRoleId}
                onChange={(e) => handleLoadPreset(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              >
                <option value="">Start from blank role...</option>
                {existingRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.rolePermissions.length} capabilities)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                Role Title *
              </label>
              <input
                type="text"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Chief AI Officer, Regional Operations Lead"
                className="w-full px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                Role Purpose (Optional)
              </label>
              <textarea
                rows={2}
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="Describe who holds this role and what they own..."
                className="w-full px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!roleName.trim()}
                onClick={() => setStep(2)}
              >
                Next: Choose Capability Packs <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Pick Packs Grouped by Workspace (+ Advanced Raw Tree Toggle) */}
      {step === 2 && (
        <div className="space-y-4">
          <Card
            title={`Step 2 — Choose Capability Packs (${selectedCodes.size} permissions selected)`}
            subtitle="Pick plain-English packs grouped by workspace, or switch to Advanced for individual permission codes."
            action={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={!isAdvancedMode ? 'primary' : 'secondary'}
                  onClick={() => setIsAdvancedMode(false)}
                >
                  Packs (40)
                </Button>
                <Button
                  size="sm"
                  variant={isAdvancedMode ? 'primary' : 'secondary'}
                  onClick={() => setIsAdvancedMode(true)}
                >
                  Advanced (21-Module Tree)
                </Button>
              </div>
            }
          >
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAdvancedMode
                    ? 'Search raw permission codes or descriptions...'
                    : 'Search packs (e.g. payroll, sprints, invoices, recruiting)...'
                }
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            {!isAdvancedMode ? (
              <div className="space-y-5">
                {packsByWorkspace.map(({ workspace, packs }) => (
                  <div key={workspace.id} className="space-y-2">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {workspace.label}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {packs.map((pack) => {
                        const active = isPackSelected(pack)
                        const partial = isPackPartial(pack)
                        return (
                          <button
                            key={pack.id}
                            type="button"
                            onClick={() => togglePack(pack)}
                            className={`text-left p-3.5 rounded-[var(--radius-control)] border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[var(--primary-soft)] border-[var(--primary)]'
                                : partial
                                  ? 'bg-[var(--warning)]/5 border-[var(--warning)]/40'
                                  : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary)]/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-[13px] text-[var(--text)]">
                                {pack.name}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {pack.riskLevel === 'critical' && (
                                  <Badge variant="danger" size="xs">
                                    ⚠ Critical
                                  </Badge>
                                )}
                                {pack.riskLevel === 'elevated' && (
                                  <Badge variant="amber" size="xs">
                                    Elevated
                                  </Badge>
                                )}
                                <Badge variant={active ? 'indigo' : 'default'} size="xs">
                                  {active ? 'Included' : partial ? 'Partial' : `${pack.codes.length}`}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-[12px] text-[var(--muted)] mt-1">{pack.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {groupedByModule.map((mod) => (
                  <div key={mod.code} className="space-y-1.5">
                    <div className="text-[12px] font-semibold text-[var(--text)]">
                      {mod.code} — {mod.name} ({mod.items.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {mod.items.map((perm) => {
                        const checked = selectedCodes.has(perm.code)
                        const display = getPermissionDisplay(perm.code, perm.description)
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-control)] border text-[12px] cursor-pointer ${
                              checked
                                ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--text)]'
                                : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCode(perm.code)}
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-[var(--text)] truncate">
                                  {perm.name || display.label}
                                </div>
                                <div className="font-mono text-[10px] truncate">{perm.code}</div>
                              </div>
                            </div>
                            {perm.isCritical && (
                              <Badge variant="danger" size="xs">
                                ⚠
                              </Badge>
                            )}
                            {isPermissionMfaRequiredEveryTime(perm.code, perm.isCritical) && (
                              <Badge variant="amber" size="xs">
                                Requires MFA code every time
                              </Badge>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={selectedCodes.size === 0}
                onClick={() => setStep(3)}
              >
                Next: Scope ({selectedCodes.size} selected) <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 3: Scope & Wildcards */}
      {step === 3 && (
        <Card
          title="Step 3 — Choose default data scope"
          subtitle="Control whether holders of this role act on their own items, their squad, department, project, or the whole company."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDefaultScope(opt.id)}
                  className={`text-left p-3.5 rounded-[var(--radius-control)] border cursor-pointer ${
                    defaultScope === opt.id
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)]'
                      : 'bg-[var(--bg)] border-[var(--border)]'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-[var(--text)]">{opt.label}</div>
                  <p className="text-[12px] text-[var(--muted)] mt-1">{opt.hint}</p>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              <div className="text-[12px] font-medium text-[var(--muted)]">
                Optional Domain Wildcards (auto-excludes ⚠ critical codes)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DOMAIN_WILDCARDS.map((w) => {
                  const active = selectedWildcards.has(w)
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        setSelectedWildcards((prev) => {
                          const next = new Set(prev)
                          if (next.has(w)) next.delete(w)
                          else next.add(w)
                          return next
                        })
                      }
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-md border cursor-pointer ${
                        active
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button variant="primary" size="sm" onClick={() => setStep(4)}>
                Next: Review &amp; Save <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Plain-English Review, Warnings & Save */}
      {step === 4 && (
        <Card
          title="Step 4 — Review role summary & save"
          subtitle="Verify what holders of this role can and cannot do before creating it."
        >
          <div className="space-y-4 text-[13px]">
            <div className="p-4 rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[16px] font-semibold text-[var(--text)]">
                  {roleName || 'Untitled Role'}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="indigo">Scope: {defaultScope}</Badge>
                  <Badge variant="default">{selectedCodes.size} permissions</Badge>
                </div>
              </div>
              <p className="text-[14px] text-[var(--text)] leading-relaxed">
                <strong>{plainSummary.canSummary}</strong>, {plainSummary.cannotSummary}
              </p>
            </div>

            {selectedCriticalCodes.length > 0 && (
              <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--danger-soft)] border border-[var(--danger)]/30 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[var(--danger)]">
                    ⚠ {selectedCriticalCodes.length} Critical Permission(s) Included
                  </div>
                  <p className="text-[12px] text-[var(--text)] mt-0.5">
                    Includes high-impact actions ({selectedCriticalCodes.join(', ')}). Saving requires step-up password confirmation.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setStep(3)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                disabled={isSubmitting || !roleName.trim() || selectedCodes.size === 0}
                onClick={() => setIsConfirmOpen(true)}
              >
                {isSubmitting ? 'Saving...' : `Create Role (${selectedCodes.size} capabilities)`}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <SecurityConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => void executeCreateRole()}
        isSubmitting={isSubmitting}
        isCritical={selectedCriticalCodes.length > 0}
        requirePassword={selectedCriticalCodes.length > 0}
        title="Confirm Create Custom Role"
        details={`Create role "${roleName.trim()}" (${defaultScope} scope) with ${selectedCodes.size} permissions.`}
        whatWillHappen={`${plainSummary.canSummary}, ${plainSummary.cannotSummary}`}
        confirmLabel="Create Role"
      />
    </div>
  )
}
