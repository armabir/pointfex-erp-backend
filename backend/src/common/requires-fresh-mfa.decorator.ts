import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { FreshMfaGuard } from './fresh-mfa.guard'

export const FRESH_MFA_ACTION_KEY = 'fresh_mfa_action_key'

/**
 * Requires a live, single-use 6-digit TOTP code (`X-MFA-Code`) bound to the
 * actor, `actionKey`, and resolved target id for every invocation.
 */
export function RequiresFreshMfa(actionKey: string) {
  return applyDecorators(
    SetMetadata(FRESH_MFA_ACTION_KEY, actionKey),
    UseGuards(FreshMfaGuard),
  )
}
