import { useState, useMemo, useCallback } from 'react'
import { erpApi } from '../../api/client'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import { PageHeader } from '../../components/common/PageHeader'
import { ListToolbar } from '../../components/common/ListToolbar'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import type { ActivityLog } from '../../types'
import { Download, ShieldCheck, ShieldAlert } from 'lucide-react'

export function CtoAuditLogPage() {
  const { auditLogs } = useCtoData()
  const { data, showToast } = useApp()

  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [chainStatus, setChainStatus] = useState<{
    valid: boolean
    checkedCount: number
    headSequence?: number
    headHash?: string
    brokenAtId?: string
    brokenReason?: string
  } | null>(null)
  const [isVerifyingChain, setIsVerifyingChain] = useState(false)

  const handleVerifyChain = async () => {
    setIsVerifyingChain(true)
    try {
      const res = await erpApi.verifyAuditChain()
      setChainStatus(res)
      showToast(
        res.valid
          ? `Hash chain verified across ${res.checkedCount} chained audit entry(ies).`
          : `Integrity check failed: ${res.brokenReason || 'Tamper detected'}`,
        res.valid ? 'success' : 'error',
      )
    } catch (err: any) {
      showToast(err?.message || 'Unable to verify audit hash chain', 'error')
    } finally {
      setIsVerifyingChain(false)
    }
  }

  // Map user ID to user name, email & role
  const getUserInfo = useCallback(
    (userId?: string, log?: ActivityLog) => {
      if (log?.actorName && log?.actorEmail && log?.actorRole) {
        return {
          name: log.actorName,
          email: log.actorEmail,
          role: log.actorRole,
        }
      }
      if (!userId)
        return { name: 'System Event', email: 'system@pointfex.internal', role: 'SYSTEM' }
      const found = data.users.find((u) => u.id === userId)
      if (found) {
        return {
          name: found.name,
          email: found.email,
          role: found.role.toUpperCase(),
        }
      }
      return { name: userId, email: `${userId}@pointfex.internal`, role: 'USER' }
    },
    [data.users],
  )

  const getActionCode = (log: ActivityLog) => {
    if (log.actionCode) return log.actionCode
    return log.action.toUpperCase().replace(/\s+/g, '_')
  }

  const getSeverity = (log: ActivityLog): 'INFO' | 'CRITICAL' | 'WARNING' | 'SUCCESS' => {
    if (log.severity) return log.severity as any
    if (
      log.action.toLowerCase().includes('token') ||
      log.action.toLowerCase().includes('critical') ||
      log.action.toLowerCase().includes('security')
    ) {
      return 'CRITICAL'
    }
    if (
      log.action.toLowerCase().includes('warning') ||
      log.action.toLowerCase().includes('reject')
    ) {
      return 'WARNING'
    }
    if (
      log.action.toLowerCase().includes('approved') ||
      log.action.toLowerCase().includes('created') ||
      log.action.toLowerCase().includes('completed')
    ) {
      return 'SUCCESS'
    }
    return 'INFO'
  }

  const processedLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const severity = getSeverity(log)
      if (severityFilter !== 'all' && severity !== severityFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const actor = getUserInfo(log.userId, log)
        const matchActorName = actor.name.toLowerCase().includes(q)
        const matchActorEmail = actor.email.toLowerCase().includes(q)
        const matchAction = getActionCode(log).toLowerCase().includes(q)
        const matchDesc = log.description?.toLowerCase().includes(q)
        const matchEntity = log.entityTitle?.toLowerCase().includes(q)
        if (!matchActorName && !matchActorEmail && !matchAction && !matchDesc && !matchEntity) {
          return false
        }
      }
      return true
    })
  }, [auditLogs, severityFilter, searchQuery, getUserInfo])

  // Export audit log as JSON file
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(processedLogs, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute(
      'download',
      `executive_audit_log_${new Date().toISOString().slice(0, 10)}.json`,
    )
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const getSeverityPill = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
            CRITICAL
          </span>
        )
      case 'WARNING':
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
            WARNING
          </span>
        )
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40">
            SUCCESS
          </span>
        )
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            INFO
          </span>
        )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Trail"
        subtitle="Immutable security, financial, and organizational activity log."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={ShieldCheck}
              onClick={handleVerifyChain}
              disabled={isVerifyingChain}
            >
              {isVerifyingChain ? 'Verifying Chain...' : 'Verify Hash Chain'}
            </Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={handleExportJson}>
              Export JSON
            </Button>
          </div>
        }
      />

      {chainStatus && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
            chainStatus.valid
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {chainStatus.valid ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>
              {chainStatus.valid
                ? `SHA-256 Audit Hash Chain Intact • Verified ${chainStatus.checkedCount} entries • Head #${chainStatus.headSequence ?? 0}`
                : `TAMPER DETECTED (${chainStatus.brokenAtId}): ${chainStatus.brokenReason}`}
            </span>
          </div>
          {chainStatus.headHash && (
            <span className="font-mono text-[10px] opacity-80">
              {chainStatus.headHash.slice(0, 16)}...
            </span>
          )}
        </div>
      )}

      {/* Saved Views, Search & Filter Chips */}
      <ListToolbar
        storageKey="audit_log"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by actor, action code, email, or payload..."
        activeFilter={severityFilter}
        onFilterChange={setSeverityFilter}
        filterChips={[
          { value: 'all', label: 'All' },
          { value: 'INFO', label: 'Info' },
          { value: 'CRITICAL', label: 'Critical' },
          { value: 'WARNING', label: 'Warning' },
          { value: 'SUCCESS', label: 'Success' },
        ]}
        defaultViews={[
          { id: 'view_all', name: 'All Events', search: '', filterValue: 'all' },
          { id: 'view_crit', name: 'Critical Only', search: '', filterValue: 'CRITICAL' },
          { id: 'view_warn', name: 'Warnings', search: '', filterValue: 'WARNING' },
        ]}
        onExportCsv={() => {
          const rows = [
            ['Timestamp', 'Actor', 'Action', 'Severity', 'Description'],
            ...processedLogs.map((l) => [
              l.timestamp,
              getUserInfo(l.userId, l).name,
              getActionCode(l),
              getSeverity(l),
              (l.description || '').replace(/[\r\n,]+/g, ' '),
            ]),
          ]
          const csv = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map((r) => r.join(',')).join('\n'))
          const a = document.createElement('a')
          a.setAttribute('href', csv)
          a.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
          document.body.appendChild(a)
          a.click()
          a.remove()
        }}
      />

      {/* Main Audit Log Card */}
      <div className="bg-white dark:bg-[#0f1422] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
        {/* Top Header Row */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="text-slate-600 dark:text-slate-300 font-medium">
            Total executive audit logs:{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{auditLogs.length}</strong>
          </div>
          <div className="text-slate-400 text-[11px]">
            Showing recent {processedLogs.length} entries
          </div>
        </div>

        {/* Table matching image1 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-6">Action</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-6 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {processedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No executive audit logs found matching criteria.
                  </td>
                </tr>
              ) : (
                processedLogs.map((log) => {
                  const actor = getUserInfo(log.userId, log)
                  const actionCode = getActionCode(log)
                  const severity = getSeverity(log)

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-6 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {log.timestamp}
                      </td>

                      {/* Actor */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block text-xs">
                            {actor.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {actor.email}
                          </span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                          {actor.role}
                        </span>
                      </td>

                      {/* Action Code */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {actionCode}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="py-4 px-4 whitespace-nowrap">{getSeverityPill(severity)}</td>

                      {/* Payload Inspect Button */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-3.5 py-1 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Payload & Execution — ${getActionCode(selectedLog)}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-slate-400">{selectedLog.id}</span>
                {getSeverityPill(getSeverity(selectedLog))}
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {selectedLog.description}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                  Actor
                </span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {getUserInfo(selectedLog.userId, selectedLog).name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {getUserInfo(selectedLog.userId, selectedLog).email}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                  Timestamp
                </span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5 font-mono">
                  {selectedLog.timestamp}
                </span>
                <span className="text-[10px] text-slate-400">Recorded by Audit Gateway</span>
              </div>
            </div>

            {/* Payload JSON Inspector */}
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1.5">
                Payload Parameters
              </span>
              <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                {JSON.stringify(
                  selectedLog.payload || {
                    id: selectedLog.id,
                    action: getActionCode(selectedLog),
                    entityType: selectedLog.entityType,
                    entityId: selectedLog.entityId,
                    entityTitle: selectedLog.entityTitle,
                    description: selectedLog.description,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
