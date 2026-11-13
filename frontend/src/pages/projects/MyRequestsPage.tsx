import { useCallback, useEffect, useState } from 'react'
import {
  ListFilter,
  Clock,
  AlertCircle,
  KeyRound,
  DollarSign,
  FolderPlus,
  Share2,
  Lightbulb,
  RefreshCw,
  Search,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { SkeletonCard } from '../../components/common/Skeleton'
import { formatDate } from '../../utils/formatters'

export function MyRequestsPage() {
  const { showToast } = useApp()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const loadMyRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await erpApi.getMyRequestsTimeline()
      setRequests(Array.isArray(res) ? res : [])
    } catch (err: any) {
      showToast(err?.message || 'Failed to load your requests.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadMyRequests()
  }, [loadMyRequests])

  const filteredRequests = requests.filter((r) => {
    if (typeFilter !== 'all' && r.kind !== typeFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.subtitle?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    )
  })

  const getIcon = (kind: string) => {
    switch (kind) {
      case 'ROLE_REQUEST':
        return KeyRound
      case 'PROJECT_CREATION':
        return FolderPlus
      case 'PROJECT_PROPOSAL':
        return Lightbulb
      case 'BUDGET_REQUEST':
        return DollarSign
      case 'DELEGATION':
        return Share2
      default:
        return AlertCircle
    }
  }

  const getStatusBadgeVariant = (status: string): 'success' | 'danger' | 'warning' | 'indigo' | 'default' => {
    if (status === 'APPROVED' || status === 'COMPLETED' || status === 'ACTIVE') return 'success'
    if (status === 'REJECTED' || status === 'DECLINED' || status === 'REVOKED') return 'danger'
    if (status === 'PENDING' || status === 'VOTING' || status === 'SUBMITTED') return 'warning'
    return 'default'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        subtitle="Unified timeline tracking all your submitted access requests, project proposals, budget increases, and delegations."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => void loadMyRequests()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        }
      />

      {/* Filter Chips */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request title or details..."
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['all', 'ROLE_REQUEST', 'PROJECT_CREATION', 'PROJECT_PROPOSAL', 'BUDGET_REQUEST', 'DELEGATION'].map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTypeFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    typeFilter === f
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {f === 'all'
                    ? 'All Requests'
                    : f.replace('_', ' ')}
                </button>
              ),
            )}
          </div>
        </div>
      </Card>

      {/* Timeline List */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListFilter}
            title="No requests found"
            description="You have not submitted any governance, project, or access requests matching your filter."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const Icon = getIcon(req.kind)
            return (
              <Card key={req.id} className="p-4 hover:border-[var(--primary)]/30 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-muted)] text-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[var(--text)]">{req.title}</span>
                        <Badge variant={getStatusBadgeVariant(req.status)} size="xs">
                          {req.status}
                        </Badge>
                        <Badge variant="default" size="xs">
                          {req.kind.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--muted)]">{req.subtitle}</p>
                      {req.notes && (
                        <p className="text-xs text-[var(--muted)] italic mt-1 bg-[var(--bg)] p-2 rounded border border-[var(--border)]">
                          "{req.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[12px] font-medium text-[var(--text)] flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-[var(--muted)]" />
                      {formatDate(req.createdAt, 'short')}
                    </span>
                    {req.reviewerName && (
                      <span className="text-[11px] text-[var(--muted)] mt-0.5 block">
                        Decider: {req.reviewerName}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
