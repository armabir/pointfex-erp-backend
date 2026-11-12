import React, { useState } from 'react'
import { ShieldAlert, ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { erpApi } from '../../api/client'
import { findNavItemByRoute } from '../../config/nav-registry'
import { getPermissionDisplay } from '../../utils/permission-dictionary'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import {
  buildAccessRequestPayload,
  resolveMissingPermissionsForRoute,
} from './access-request-helpers'

export interface AccessDeniedPageProps {
  routeId: string
  missingPermissions?: string[]
}

export interface AccessDeniedCardProps {
  routeId: string
  routeLabel: string
  missingPermissions: string[]
  canSubmitRequest: boolean
  isFormOpen: boolean
  isSubmitting: boolean
  submitted: boolean
  reason: string
  onChangeReason: (reason: string) => void
  onOpenForm: () => void
  onCloseForm: () => void
  onSubmitForm: (e: React.FormEvent) => void
  onBackHome: () => void
}

export function AccessDeniedCard({
  routeId,
  routeLabel,
  missingPermissions,
  canSubmitRequest,
  isFormOpen,
  isSubmitting,
  submitted,
  reason,
  onChangeReason,
  onOpenForm,
  onCloseForm,
  onSubmitForm,
  onBackHome,
}: AccessDeniedCardProps) {
  return (
    <div className="max-w-xl mx-auto py-8 sm:py-12">
      <Card>
        <div className="text-center space-y-4 py-4">
          <div className="inline-flex p-3 rounded-[var(--radius-card)] bg-[var(--danger-soft)] text-[var(--danger)]">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-[20px] font-semibold text-[var(--text)]">Access Restricted</h1>
            <p className="text-[14px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              Your current account permissions do not include access to{' '}
              <span className="font-semibold text-[var(--text)]">{routeLabel || routeId}</span>.
            </p>
          </div>

          {missingPermissions.length > 0 && (
            <div className="text-left p-4 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border)] space-y-2">
              <div className="text-[12px] font-medium text-[var(--muted)]">
                Required capability
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missingPermissions.slice(0, 4).map((code) => {
                  const display = getPermissionDisplay(code)
                  return (
                    <Badge key={code} variant="default" size="sm" title={code}>
                      {display.label}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {submitted ? (
            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--success-soft)] text-[var(--success)] text-[13px] font-medium inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Request submitted for review. Check Approval Inbox for updates.</span>
            </div>
          ) : isFormOpen ? (
            <form onSubmit={onSubmitForm} className="text-left space-y-3 pt-2">
              <label className="block text-[13px] font-medium text-[var(--text)]">
                Why do you need this access?
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => onChangeReason(e.target.value)}
                placeholder="Briefly describe the task or project requiring access..."
                className="w-full px-3.5 py-2.5 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)] text-[14px] text-[var(--text)]"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onCloseForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" icon={Send} disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={onBackHome}>
              Back to Home
            </Button>
            {canSubmitRequest && !submitted && !isFormOpen && (
              <Button variant="primary" icon={Send} onClick={onOpenForm}>
                Request Access
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export function AccessDeniedPage({ routeId, missingPermissions }: AccessDeniedPageProps) {
  const { currentUser, setRoute, can, showToast } = useApp()
  const targetNav = findNavItemByRoute(routeId)
  const resolvedMissing = resolveMissingPermissionsForRoute(routeId, missingPermissions)
  const canSubmitRequest = can('approvals:create')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser?.id) return
    setIsSubmitting(true)
    try {
      const payload = buildAccessRequestPayload({
        userId: currentUser.id,
        routeId,
        routeLabel: targetNav?.label,
        missingPermissions: resolvedMissing,
        reason,
      })
      await erpApi.initiateApproval(payload)
      setSubmitted(true)
      setIsFormOpen(false)
      showToast('Access request sent to the approval inbox.', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit access request right now.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AccessDeniedCard
      routeId={routeId}
      routeLabel={targetNav?.label || routeId}
      missingPermissions={resolvedMissing}
      canSubmitRequest={canSubmitRequest}
      isFormOpen={isFormOpen}
      isSubmitting={isSubmitting}
      submitted={submitted}
      reason={reason}
      onChangeReason={setReason}
      onOpenForm={() => setIsFormOpen(true)}
      onCloseForm={() => setIsFormOpen(false)}
      onSubmitForm={handleRequestAccess}
      onBackHome={() => setRoute('dashboard')}
    />
  )
}
