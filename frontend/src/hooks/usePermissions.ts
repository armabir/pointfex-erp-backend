import { useMemo } from 'react'
import { useApp } from '../context/AppContext'

export function usePermissions() {
  const {
    rolePermissions,
    myPermissions,
    directPermissions,
    authzSnapshot,
    hasPermission,
    hasAnyPermission,
    can,
    canAny,
    refreshPermissions,
  } = useApp()

  const permissionSet = useMemo(() => new Set(myPermissions), [myPermissions])

  return {
    rolePermissions,
    permissions: myPermissions,
    directPermissions,
    authzSnapshot,
    isRoot: Boolean(authzSnapshot?.isRoot),
    permissionSet,
    hasPermission,
    hasAnyPermission,
    can,
    canAny,
    refreshPermissions,
  }
}
