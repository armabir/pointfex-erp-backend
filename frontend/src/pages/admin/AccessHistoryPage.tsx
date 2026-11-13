import { useCallback, useEffect, useState } from 'react'
import {
  History,
  Download,
  Filter,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { SkeletonCard } from '../../components/common/Skeleton'
import { EmptyState } from '../../components/common/EmptyState'
import { formatDate } from '../../utils/formatters'

export function AccessHistoryPage() {
  const { showToast } = useApp()

  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const fetchHistory = useCallback(async (pageNum = 1) => {
    setIsLoading(true)
    try {
      const res = await erpApi.getAccessHistory({
        page: pageNum,
        limit: 20,
        changeType: changeTypeFilter !== 'all' ? changeTypeFilter : undefined,
      })
      setItems(res?.items || [])
      setTotal(res?.total || 0)
      setPage(res?.page || 1)
      setTotalPages(res?.totalPages || 1)
    } catch (err: any) {
      showToast(err?.message || 'Failed to load access history records.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [changeTypeFilter, showToast])

  useEffect(() => {
    void fetchHistory(1)
  }, [fetchHistory])

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true)
    try {
      const res = await erpApi.exportAccessHistory(format)
      const dataStr = format === 'json' ? JSON.stringify(res, null, 2) : String(res)
      const blob = new Blob([dataStr], {
        type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `access-history-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast(`Exported ${format.toUpperCase()} successfully.`, 'success')
    } catch (err: any) {
      showToast(err?.message || 'Export failed.', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const actor = item.actor?.name?.toLowerCase() || item.actorId?.toLowerCase() || ''
    const target =
      item.targetEmployee?.name?.toLowerCase() || item.targetEmployeeId?.toLowerCase() || ''
    const reason = item.reason?.toLowerCase() || ''
    const details = JSON.stringify(item.details || {}).toLowerCase()
    return actor.includes(q) || target.includes(q) || reason.includes(q) || details.includes(q)
  })

  // Summary counts
  const grantCount = items.filter((i) => i.changeType === 'GRANT' || i.changeType === 'ROLE_ASSIGN').length
  const revokeCount = items.filter((i) => i.changeType === 'REVOKE' || i.changeType === 'ROLE_REVOKE').length

  const getBadgeVariant = (type: string): 'success' | 'danger' | 'warning' | 'indigo' | 'default' => {
    if (type.includes('GRANT') || type.includes('ASSIGN')) return 'success'
    if (type.includes('REVOKE') || type.includes('DELETE')) return 'danger'
    if (type.includes('DELEGAT')) return 'warning'
    if (type.includes('IDENTITY') || type.includes('TIER')) return 'indigo'
    return 'default'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access History"
        subtitle="Immutable ledger of permission grants, role adjustments, delegations, and identity changes. Restricted to CEO and Executives."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => void handleExport('csv')}
              disabled={isExporting}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => void handleExport('json')}
              disabled={isExporting}
            >
              Export JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => void fetchHistory(page)}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Total Logged Changes</p>
              <p className="text-2xl font-bold text-[var(--text)] mt-1">{total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Grants on Current Page</p>
              <p className="text-2xl font-bold text-[var(--success)] mt-1">{grantCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--success)]/10 text-[var(--success)] flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Revocations on Current Page</p>
              <p className="text-2xl font-bold text-[var(--danger)] mt-1">{revokeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--danger)]/10 text-[var(--danger)] flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Tamper Protection</p>
              <p className="text-sm font-semibold text-[var(--primary)] mt-1">Audit Chained</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by actor, affected person, or keyword..."
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[var(--muted)]" />
            <select
              value={changeTypeFilter}
              onChange={(e) => setChangeTypeFilter(e.target.value)}
              className="px-3 py-2 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Change Types</option>
              <option value="ROLE_ASSIGN">Role Assignment</option>
              <option value="ROLE_REVOKE">Role Revocation</option>
              <option value="TIER_CHANGE">Tier Change</option>
              <option value="IDENTITY_EDIT">Identity Edit (CEO)</option>
              <option value="GRANT">Direct Permission Grant</option>
              <option value="REVOKE">Direct Permission Revoke</option>
              <option value="DELEGATION_CREATE">Delegation Granted</option>
              <option value="DELEGATION_REVOKE">Delegation Revoked</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Timeline Table */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No access change records"
            description="No permission or role modifications match your selected criteria."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((record) => {
            const actorName = record.actor?.name || record.actorId || 'System'
            const targetName = record.targetEmployee?.name || record.targetEmployeeId || 'Organization'

            return (
              <Card key={record.id} className="p-4 transition-colors hover:border-[var(--primary)]/40">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getBadgeVariant(record.changeType)} size="xs">
                        {record.changeType.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[14px] font-semibold text-[var(--text)] flex items-center gap-1.5">
                        <span>{actorName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)]" />
                        <span>{targetName}</span>
                      </span>
                    </div>

                    {record.reason && (
                      <p className="text-[13px] text-[var(--muted)] bg-[var(--bg)] px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border)] inline-block">
                        <span className="font-medium text-[var(--text)]">Reason:</span> "{record.reason}"
                      </p>
                    )}

                    {record.details && Object.keys(record.details).length > 0 && (
                      <div className="text-[12px] text-[var(--muted)] font-mono bg-[var(--bg)]/50 p-2 rounded-[var(--radius-control)] overflow-x-auto">
                        {JSON.stringify(record.details)}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-end justify-between md:justify-start gap-1 shrink-0 text-right">
                    <span className="text-[12px] font-medium text-[var(--text)] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[var(--primary)]" />
                      {formatDate(record.createdAt, 'short')}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {new Date(record.createdAt).toLocaleTimeString('en-US', {
                        timeZone: 'Asia/Dhaka',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      BST
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[12px] text-[var(--muted)]">
                Page {page} of {totalPages} ({total} total changes)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => void fetchHistory(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => void fetchHistory(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
