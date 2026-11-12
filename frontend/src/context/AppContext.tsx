import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { getInitialSeedData, createDataResolvers } from '../data'
import { ROLES } from '../data/roles'
import { erpApi, setOnUnauthorized, type AuthSessionUser } from '../api/client'
import { mapBackendBundleToSeedData } from '../api/adapter'
import { getDefaultPermissionsForRole } from '../utils/role-permissions-fallback'
import { resolveRouteIdFromPath } from '../utils/permission-routes'
import { formatBDT } from '../utils/money'
import type {
  SeedData,
  AppContextType,
  User,
  Team,
  Task,
  Report,
  Project,
  TaskStatus,
  TaskPriority,
  TaskChecklistItem,
  ToastMessage,
  ActivityLog,
  ProjectMilestone,
  DirectPermissionDelegation,
  AuthorizationScope,
  EffectiveAuthzSnapshot,
} from '../types'

const SCOPE_ORDER: Record<AuthorizationScope, number> = {
  SELF: 1,
  ASSIGNED: 2,
  SQUAD: 3,
  DEPARTMENT: 4,
  PROJECT: 5,
  ORG: 6,
  GLOBAL: 7,
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  // 1. Initial State with URL hash & localStorage persistence
  const [data, setData] = useState<SeedData>(() => getInitialSeedData())
  const positionsRef = useRef<any[]>([])

  const [currentRole, setCurrentRole] = useState<string>(() => {
    return localStorage.getItem('pointfex_role') || 'developer'
  })

  const [currentDevId, setCurrentDevId] = useState<string>(() => {
    const stored = localStorage.getItem('pointfex_dev_id')
    if (stored && !stored.startsWith('user_')) return stored
    return 'emp_dev_01'
  })

  const [currentPmId, setCurrentPmId] = useState<string>(() => {
    const stored = localStorage.getItem('pointfex_pm_id')
    if (stored && !stored.startsWith('user_')) return stored
    return 'emp_pm_01'
  })

  const [currentRoute, setCurrentRouteState] = useState<string>(() => {
    const hashRoute = window.location.hash.replace('#', '')
    if (hashRoute) return hashRoute
    return localStorage.getItem('pointfex_route') || 'dashboard'
  })

  const [theme, setTheme] = useState<string>(() => {
    const stored = localStorage.getItem('pointfex_theme')
    if (stored === 'light' || stored === 'dark') return stored
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false)
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true)
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false)
  const [rolePermissions, setRolePermissions] = useState<string[]>(() =>
    getDefaultPermissionsForRole(localStorage.getItem('pointfex_role') || 'developer'),
  )
  const [myPermissions, setMyPermissions] = useState<string[]>(() =>
    getDefaultPermissionsForRole(localStorage.getItem('pointfex_role') || 'developer'),
  )
  const myPermissionsRef = useRef<string[]>(myPermissions)
  const [directPermissions, setDirectPermissions] = useState<DirectPermissionDelegation[]>([])
  const [authzSnapshot, setAuthzSnapshot] = useState<EffectiveAuthzSnapshot | null>(null)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0)
  const [recentRoutes, setRecentRoutes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pointfex_recent_routes')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed.slice(0, 5) : ['dashboard']
    } catch {
      return ['dashboard']
    }
  })
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [selectedTaskModal, setSelectedTaskModal] = useState<any>(null)
  const [selectedProjectModal, setSelectedProjectModal] = useState<any>(null)
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null)

  const showToast = useCallback(
    (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      setToastMessage({ msg, type, id: Date.now() })
      setTimeout(() => {
        setToastMessage((prev) => (prev && prev.msg === msg ? null : prev))
      }, 3500)
    },
    [],
  )

  // 2. Sync full state from Backend API (strictly scoped by role/permissions, deduplicated)
  const inFlightSyncRef = useRef<Promise<void> | null>(null)
  const syncFromBackend = useCallback(
    async (roleOverride?: string, userIdOverride?: string) => {
      if (!userIdOverride && !authUser?.id) return
      if (inFlightSyncRef.current) return inFlightSyncRef.current
      const targetRole = roleOverride || authUser?.role || currentRole
      const actorId = userIdOverride || authUser?.id || currentDevId

      const run = (async () => {
        try {
          setIsDataLoading(true)
          const [myPermsRes, effectiveRes] = await Promise.all([
            erpApi.getMyPermissions().catch(() => null),
            erpApi.getMyEffectiveAuthz().catch(() => null),
          ])
        if (effectiveRes) {
          setAuthzSnapshot(effectiveRes)
        }
        const resolvedPerms =
          effectiveRes?.effectiveCodes ||
          myPermsRes?.permissions ||
          getDefaultPermissionsForRole(targetRole)
        const activePermSet = new Set<string>(resolvedPerms)
        const canReadAudit =
          activePermSet.has('system:root') ||
          activePermSet.has('audit_logs:read') ||
          activePermSet.has('audit_logs:read_confidential')
        const canReadBudgets =
          activePermSet.has('system:root') ||
          activePermSet.has('budgets:read_requests') ||
          activePermSet.has('budgets:approve_request') ||
          activePermSet.has('budgets:allocate_project') ||
          activePermSet.has('budgets:request_increase')
        const canReadApprovals =
          activePermSet.has('system:root') ||
          activePermSet.has('approvals:read') ||
          activePermSet.has('approvals:approve') ||
          activePermSet.has('approvals:reject') ||
          activePermSet.has('governance:approve_request') ||
          activePermSet.has('payroll:approve_batch') ||
          activePermSet.has('budgets:approve_request') ||
          activePermSet.has('tasks:approve')

        if (canReadApprovals) {
          void erpApi
            .getApprovalInbox()
            .then((rows) => setPendingApprovalsCount(Array.isArray(rows) ? rows.length : 0))
            .catch(() => setPendingApprovalsCount(0))
        } else {
          setPendingApprovalsCount(0)
        }

        if (myPermsRes?.permissions) {
          setRolePermissions(
            Array.isArray(myPermsRes.rolePermissions)
              ? myPermsRes.rolePermissions
              : getDefaultPermissionsForRole(targetRole),
          )
          setDirectPermissions(
            Array.isArray(myPermsRes.directPermissions) ? myPermsRes.directPermissions : [],
          )
        } else {
          setRolePermissions(getDefaultPermissionsForRole(targetRole))
        }
        setMyPermissions(resolvedPerms)
        myPermissionsRef.current = resolvedPerms
        setAuthUser((prev) =>
          prev
            ? {
                ...prev,
                roles: Array.isArray(myPermsRes?.roles) ? myPermsRes.roles : prev.roles,
                permissions: resolvedPerms,
              }
            : prev,
        )

        const isRoot = activePermSet.has('system:root') || activePermSet.has('*')
        const canFetch = (code: string) => isRoot || activePermSet.has(code)

        const [
          employees,
          positions,
          teams,
          projects,
          tasks,
          treasury,
          wallets,
          transactions,
          budgetRequests,
          performance,
          reports,
          auditLogs,
          qualityGates,
          securityAlerts,
          testRuns,
          consultancy,
          announcements,
          notifications,
        ] = await Promise.all([
          erpApi.getEmployees(),
          canFetch('positions:read')
            ? erpApi.getPositions().catch(() => [])
            : Promise.resolve([]),
          erpApi.getTeams(),
          erpApi.getProjects(),
          erpApi.getTasks(),
          canFetch('treasury:read')
            ? erpApi.getTreasury().catch(() => null)
            : Promise.resolve(null),
          canFetch('wallets:read_all')
            ? erpApi.getWallets().catch(() => [])
            : actorId
              ? erpApi
                  .getWallet(actorId)
                  .then((w) => (w ? [w] : []))
                  .catch(() => [])
              : Promise.resolve([]),
          canFetch('treasury:read') || canFetch('wallets:read_all') || canFetch('wallets:read_own')
            ? erpApi.getTransactions().catch(() => [])
            : Promise.resolve([]),
          canReadBudgets ? erpApi.getBudgetRequests().catch(() => []) : Promise.resolve([]),
          canFetch('performance:read') || canFetch('employees:read')
            ? erpApi.getPerformance().catch(() => [])
            : Promise.resolve([]),
          canFetch('reports:read') || canFetch('reports:submit')
            ? erpApi.getReports().catch(() => [])
            : Promise.resolve([]),
          canReadAudit ? erpApi.getAuditLogs().catch(() => []) : Promise.resolve([]),
          canFetch('code_quality:read') || canFetch('projects:read')
            ? erpApi.getQualityGates().catch(() => [])
            : Promise.resolve([]),
          canFetch('security:read') || canFetch('audit_logs:read')
            ? erpApi.getSecurityAlerts().catch(() => [])
            : Promise.resolve([]),
          canFetch('testing:read') || canFetch('projects:read')
            ? erpApi.getTestRuns().catch(() => [])
            : Promise.resolve([]),
          canFetch('consultancy:read') || canFetch('projects:read')
            ? erpApi.getConsultancy().catch(() => [])
            : Promise.resolve([]),
          erpApi.getAnnouncements().catch(() => []),
          erpApi.getNotifications().catch(() => []),
        ])

        positionsRef.current = positions

        setData((prev) => {
          const mapped = mapBackendBundleToSeedData(
            {
              employees,
              positions,
              teams,
              projects,
              tasks,
              treasury,
              wallets,
              transactions,
              budgetRequests,
              performance,
              reports,
              auditLogs,
              qualityGates,
              securityAlerts,
              testRuns,
              consultancy,
              announcements,
              notifications,
            },
            prev,
          )

          // Reconcile default dev/pm IDs if they still pointed at static mock IDs
          if (!mapped.users.some((u) => u.id === currentDevId)) {
            const firstDev = mapped.users.find((u) => u.role === 'developer')
            if (firstDev) {
              setCurrentDevId(firstDev.id)
              localStorage.setItem('pointfex_dev_id', firstDev.id)
            }
          }
          if (!mapped.users.some((u) => u.id === currentPmId)) {
            const firstPm = mapped.users.find((u) => u.role === 'pm')
            if (firstPm) {
              setCurrentPmId(firstPm.id)
              localStorage.setItem('pointfex_pm_id', firstPm.id)
            }
          }

          return mapped
        })
      } catch (err: any) {
        if (err?.message) {
          showToast('Unable to synchronize workspace data with server.', 'warning')
        }
        } finally {
          setIsDataLoading(false)
          inFlightSyncRef.current = null
        }
      })()

      inFlightSyncRef.current = run
      return run
    },
    // Intentionally excludes `data.users` to prevent fetch loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentRole, currentDevId, currentPmId, authUser?.role],
  )

  // Hydrate authenticated HttpOnly cookie session on app boot
  useEffect(() => {
    setOnUnauthorized(() => {
      setAuthUser(null)
      setRolePermissions([])
      setMyPermissions([])
      myPermissionsRef.current = []
      setDirectPermissions([])
    setAuthzSnapshot(null)
      if (
        window.location.pathname !== '/login' &&
        !window.location.pathname.startsWith('/reset-password')
      ) {
        window.history.replaceState(null, '', '/login' + window.location.search)
      }
    })

    let cancelled = false
    const bootstrapAuth = async () => {
      try {
        const me = await erpApi.getAuthMe()
        if (cancelled) return
        const normRole = me.role === 'chro' ? 'cpo' : me.role
        setAuthUser(me)
        setCurrentRole(normRole)
        localStorage.setItem('pointfex_role', normRole)
        if (normRole === 'developer') {
          setCurrentDevId(me.id)
          localStorage.setItem('pointfex_dev_id', me.id)
        } else if (normRole === 'pm') {
          setCurrentPmId(me.id)
          localStorage.setItem('pointfex_pm_id', me.id)
        }
        setMyPermissions(
          Array.isArray(me.permissions) && me.permissions.length > 0
            ? me.permissions
            : getDefaultPermissionsForRole(normRole),
        )
        if (window.location.pathname === '/login') {
          window.history.replaceState(null, '', '/')
        }
        setIsAuthChecking(false)
        if (!me.mustChangePassword && !me.mustEnrollMfa) {
          await syncFromBackend(normRole, me.id)
        }
      } catch {
        if (cancelled) return
        setAuthUser(null)
        setIsAuthChecking(false)
        if (
          window.location.pathname !== '/login' &&
          !window.location.pathname.startsWith('/reset-password')
        ) {
          window.history.replaceState(null, '', '/login' + window.location.search)
        }
      }
    }

    void bootstrapAuth()
    return () => {
      cancelled = true
      setOnUnauthorized(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Seamless DAC hot-reload: refresh effective permissions & direct delegations on route changes, focus, and interval
  const refreshAccessProfile = useCallback(async () => {
    if (!authUser?.id) return
    try {
      const [profile, effectiveRes] = await Promise.all([
        erpApi.getMyPermissions(),
        erpApi.getMyEffectiveAuthz().catch(() => null),
      ])
      if (effectiveRes) {
        setAuthzSnapshot(effectiveRes)
      }
      const nextPerms = Array.isArray(effectiveRes?.effectiveCodes)
        ? effectiveRes.effectiveCodes
        : Array.isArray(profile.permissions)
          ? profile.permissions
          : []
      const nextDirect = Array.isArray(profile.directPermissions) ? profile.directPermissions : []

      const prevKey = [...myPermissionsRef.current].sort().join('|')
      const nextKey = [...nextPerms].sort().join('|')

      if (Array.isArray(profile.rolePermissions)) {
        setRolePermissions(profile.rolePermissions)
      }
      setDirectPermissions(nextDirect)
      setMyPermissions(nextPerms)
      myPermissionsRef.current = nextPerms
      setAuthUser((prev) =>
        prev
          ? {
              ...prev,
              roles: Array.isArray(profile.roles) ? profile.roles : prev.roles,
              permissions: nextPerms,
            }
          : prev,
      )

      if (prevKey !== nextKey) {
        await syncFromBackend()
      }
    } catch {
      // Ignore transient network errors during background access synchronization
    }
  }, [authUser?.id, syncFromBackend])

  useEffect(() => {
    if (!authUser?.id) return
    void refreshAccessProfile()
  }, [currentRoute, authUser?.id, refreshAccessProfile])

  useEffect(() => {
    if (!authUser?.id) return
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshAccessProfile()
      }
    }
    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    const intervalId = window.setInterval(() => {
      void refreshAccessProfile()
    }, 10000)

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.clearInterval(intervalId)
    }
  }, [authUser?.id, refreshAccessProfile])

  // Helper to run an API call and refresh from PostgreSQL
  const runApiMutation = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      try {
        await fn()
        await syncFromBackend()
        if (successMsg) showToast(successMsg, 'success')
      } catch (err: any) {
        showToast(err?.message || 'Backend request failed', 'error')
        await syncFromBackend()
      }
    },
    [showToast, syncFromBackend],
  )

  // 3. Sync theme to document.documentElement class (remembered per user, defaulting to system preference)
  useEffect(() => {
    if (!authUser?.id) return
    const userPref = localStorage.getItem(`pointfex_theme_${authUser.id}`)
    if (userPref === 'light' || userPref === 'dark') {
      setTheme(userPref)
    } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
  }, [authUser?.id])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('pointfex_theme', theme)
    if (authUser?.id) {
      localStorage.setItem(`pointfex_theme_${authUser.id}`, theme)
    }
  }, [theme, authUser?.id])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  // 4. Persistent Route Handler (stores recent pages cleanly)
  const setRoute = useCallback((routeInput: string) => {
    const routeId = resolveRouteIdFromPath(routeInput)
    setCurrentRouteState(routeId)
    localStorage.setItem('pointfex_route', routeId)
    setRecentRoutes((prev) => {
      const next = [routeId, ...prev.filter((r) => r !== routeId)].slice(0, 5)
      localStorage.setItem('pointfex_recent_routes', JSON.stringify(next))
      return next
    })
    window.location.hash = routeId
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      const hashRoute = window.location.hash.replace('#', '')
      if (hashRoute && hashRoute !== currentRoute) {
        setCurrentRouteState(hashRoute)
        localStorage.setItem('pointfex_route', hashRoute)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [currentRoute])

  const resolvers = useMemo(() => createDataResolvers(data), [data])

  const currentUser = useMemo<User | null>(() => {
    if (authUser) {
      const matched = data.users.find((u) => u.id === authUser.id)
      if (matched) return matched
      return {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: (authUser.role === 'chro' ? 'cpo' : authUser.role) as User['role'],
        title: authUser.title,
        initials: authUser.initials || 'PF',
        avatar: authUser.avatarUrl || '',
        status: (authUser.status || 'online') as User['status'],
        isSuspended: Boolean(authUser.isSuspended),
        skills: [],
        activeRoleSlugs: (authUser.roles || []).map((r: any) => r.slug),
      }
    }
    return null
  }, [authUser, data.users])

  const currentTeam = useMemo<Team | null>(() => {
    if (currentRole === 'pm') {
      return data.teams.find((t) => t.pmId === currentPmId || t.id === currentUser?.teamId) || null
    }
    if (!currentUser?.teamId) return null
    return resolvers.getTeam(currentUser.teamId)
  }, [currentRole, currentPmId, currentUser, resolvers, data.teams])

  const finalizeAuthenticatedUser = useCallback(
    async (user: NonNullable<Awaited<ReturnType<typeof erpApi.login>>['user']>) => {
      const normRole = user.role === 'chro' ? 'cpo' : user.role
      setAuthUser(user)
      setCurrentRole(normRole)
      localStorage.setItem('pointfex_role', normRole)
      if (normRole === 'developer') {
        setCurrentDevId(user.id)
        localStorage.setItem('pointfex_dev_id', user.id)
      } else if (normRole === 'pm') {
        setCurrentPmId(user.id)
        localStorage.setItem('pointfex_pm_id', user.id)
      }
      const initialPerms =
        Array.isArray(user.permissions) && user.permissions.length > 0
          ? user.permissions
          : getDefaultPermissionsForRole(normRole)
      setRolePermissions(getDefaultPermissionsForRole(normRole))
      setMyPermissions(initialPerms)
      myPermissionsRef.current = initialPerms
      setCurrentRouteState('dashboard')
      localStorage.setItem('pointfex_route', 'dashboard')
      if (window.location.pathname === '/login') {
        window.history.replaceState(null, '', '/')
      }
      if (!user.mustChangePassword && !user.mustEnrollMfa) {
        await syncFromBackend(normRole, user.id)
        showToast(`Signed in as ${user.name} (${user.title})`, 'success')
      } else {
        showToast('First-login security setup required before accessing workspace.', 'warning')
      }
    },
    [showToast, syncFromBackend],
  )

  const loginWithCredentials = useCallback(
    async (
      email: string,
      password: string,
      options?: { mfaCode?: string; recoveryCode?: string },
    ): Promise<{ mfaRequired?: boolean }> => {
      const res = await erpApi.login(email, password, options)
      if (res.mfaRequired || !res.user) {
        return { mfaRequired: true }
      }
      await finalizeAuthenticatedUser(res.user)
      return { mfaRequired: false }
    },
    [finalizeAuthenticatedUser],
  )

  const completeGoogleLogin = useCallback(
    async (body: {
      code?: string
      pendingToken?: string
      mfaCode?: string
      recoveryCode?: string
    }): Promise<{ mfaRequired?: boolean; pendingToken?: string }> => {
      const res = await erpApi.exchangeGoogleCode(body)
      if (res.mfaRequired || !res.user) {
        return { mfaRequired: true, pendingToken: res.pendingToken }
      }
      await finalizeAuthenticatedUser(res.user)
      return { mfaRequired: false }
    },
    [finalizeAuthenticatedUser],
  )

  const logout = useCallback(() => {
    void erpApi.logoutSession().catch(() => undefined)
    setAuthUser(null)
    setRolePermissions([])
    setMyPermissions([])
    myPermissionsRef.current = []
    setDirectPermissions([])
    setAuthzSnapshot(null)
    if (window.location.pathname !== '/login') {
      window.history.replaceState(null, '', '/login')
    }
    showToast('Signed out of Pointfex ERP', 'info')
  }, [showToast])

  const can = useCallback(
    (code: string, scope?: AuthorizationScope, targetScopeId?: string): boolean => {
      if (!code) return true
      if (authzSnapshot) {
        if (authzSnapshot.isSuspended) return false
        if (authzSnapshot.isRoot) return true

        const candidateCodes = new Set<string>([
          code,
          ...(authzSnapshot.aliasReverse?.[code] ?? []),
          ...(authzSnapshot.aliasForward?.[code] ?? []),
        ])
        const reqScope: AuthorizationScope =
          scope ??
          (code.endsWith('_own')
            ? 'SELF'
            : code.endsWith('_team')
              ? 'SQUAD'
              : code.endsWith('_dept')
                ? 'DEPARTMENT'
                : code.endsWith('_all')
                  ? 'ORG'
                  : 'SELF')

        const denied = authzSnapshot.denials.some((d) => {
          if (!candidateCodes.has(d.code)) return false
          if (d.scope === 'GLOBAL' || d.scope === 'ORG') return true
          if (targetScopeId && d.scopeIds.length > 0) return d.scopeIds.includes(targetScopeId)
          return SCOPE_ORDER[d.scope] >= SCOPE_ORDER[reqScope]
        })
        if (denied) return false

        return authzSnapshot.grants.some((g) => {
          if (!candidateCodes.has(g.code)) return false
          if (g.expiresAt && new Date(g.expiresAt).getTime() <= Date.now()) return false
          if (g.scope === 'GLOBAL') return true
          if (g.scope === 'ORG') return reqScope !== 'GLOBAL'
          if (SCOPE_ORDER[g.scope] < SCOPE_ORDER[reqScope]) return false
          if (
            targetScopeId &&
            (g.scope === 'PROJECT' || g.scope === 'SQUAD' || g.scope === 'DEPARTMENT') &&
            g.scopeIds.length > 0
          ) {
            return g.scopeIds.includes(targetScopeId)
          }
          return true
        })
      }

      return myPermissions.includes(code) || myPermissions.includes('system:root')
    },
    [authzSnapshot, myPermissions],
  )

  const canAny = useCallback(
    (codes: string[], scope?: AuthorizationScope, targetScopeId?: string): boolean =>
      codes.length === 0 || codes.some((c) => can(c, scope, targetScopeId)),
    [can],
  )

  const hasPermission = useCallback((code: string) => can(code), [can])

  const hasAnyPermission = useCallback((...codes: string[]) => canAny(codes), [canAny])

  // Handler: Change Role
  const handleSetRole = useCallback(
    (roleId: string) => {
      const normalizedRole = roleId === 'chro' ? 'cpo' : roleId
      setCurrentRole(normalizedRole)
      localStorage.setItem('pointfex_role', normalizedRole)
      setMyPermissions(getDefaultPermissionsForRole(normalizedRole))
      if (normalizedRole === 'developer') {
        setRoute(localStorage.getItem('pointfex_route') || 'dashboard')
        showToast('Switched to Developer Workspace', 'success')
      } else if (normalizedRole === 'pm') {
        setRoute(localStorage.getItem('pointfex_pm_route') || 'dashboard')
        showToast('Switched to Project Manager Workspace', 'success')
      } else if (normalizedRole === 'cto') {
        setRoute(localStorage.getItem('pointfex_cto_route') || 'dashboard')
        showToast('Switched to CTO Engineering Command', 'success')
      } else if (normalizedRole === 'cfo') {
        setRoute(localStorage.getItem('pointfex_cfo_route') || 'dashboard')
        showToast('Switched to CFO Financial Desk', 'success')
      } else if (normalizedRole === 'cpo') {
        setRoute(localStorage.getItem('pointfex_cpo_route') || 'dashboard')
        showToast('Switched to CHRO People & Culture Hub', 'success')
      } else if (normalizedRole === 'ceo') {
        setRoute(localStorage.getItem('pointfex_ceo_route') || 'dashboard')
        showToast('Switched to CEO Executive Command Suite', 'success')
      } else {
        const targetRole = ROLES[roleId.toUpperCase()]?.name || roleId
        showToast(`Switched to ${targetRole}`, 'info')
      }
    },
    [setRoute, showToast],
  )

  const handleSetPmId = useCallback(
    (pmId: string) => {
      setCurrentPmId(pmId)
      localStorage.setItem('pointfex_pm_id', pmId)
      const pm = resolvers.getUser(pmId)
      showToast(`Active PM: ${pm?.name || 'Project Manager'}`, 'info')
    },
    [resolvers, showToast],
  )

  // --- TASK HANDLERS ---

  const handleUpdateTaskStatus = useCallback(
    (taskId: string, newStatus: TaskStatus): boolean => {
      if (currentRole === 'developer' && newStatus === 'completed') {
        showToast(
          'Permission denied: Only Project Managers (PM) can mark tasks as Completed',
          'error',
        )
        return false
      }

      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      }))

      void runApiMutation(
        () => erpApi.updateTaskStatus(taskId, newStatus),
        `Task moved to "${newStatus.replace('_', ' ')}"`,
      )
      return true
    },
    [currentRole, runApiMutation, showToast],
  )

  const handleAddTaskComment = useCallback(
    (taskId: string, content: string) => {
      const authorId = currentUser?.id || currentDevId
      setData((prev) => ({
        ...prev,
        comments: [
          ...prev.comments,
          {
            id: `comm_${Date.now()}`,
            taskId,
            authorId,
            content,
            createdAt: new Date().toISOString(),
          },
        ],
      }))

      void runApiMutation(() => erpApi.addTaskComment(taskId, content), 'Comment posted')
    },
    [currentUser?.id, currentDevId, runApiMutation],
  )

  const handleUpdateUserProfile = useCallback(
    (updatedFields: Partial<User>) => {
      const targetId = currentUser?.id || currentDevId
      setData((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === targetId ? { ...u, ...updatedFields } : u)),
      }))

      const payload: Record<string, unknown> = {}
      if (updatedFields.name !== undefined) payload.name = updatedFields.name
      if (updatedFields.title !== undefined) payload.title = updatedFields.title
      if (updatedFields.avatarUrl !== undefined || updatedFields.avatar !== undefined) {
        payload.avatarUrl = updatedFields.avatarUrl || updatedFields.avatar
      }
      if (updatedFields.status !== undefined) payload.status = updatedFields.status
      if (updatedFields.skills !== undefined) payload.skills = updatedFields.skills
      if (updatedFields.timezone !== undefined) payload.timezone = updatedFields.timezone
      if (updatedFields.github !== undefined) payload.github = updatedFields.github
      if (updatedFields.phone !== undefined) payload.phone = updatedFields.phone
      if (updatedFields.location !== undefined) payload.location = updatedFields.location
      if (updatedFields.bio !== undefined) payload.bio = updatedFields.bio

      void runApiMutation(
        () => erpApi.updateEmployee(targetId, payload),
        'Profile updated successfully',
      )
    },
    [currentUser?.id, currentDevId, runApiMutation],
  )

  const handleAddSubmission = useCallback(
    (submission: Report) => {
      setData((prev) => ({
        ...prev,
        reports: [submission, ...prev.reports],
      }))

      void runApiMutation(
        () =>
          erpApi.createReport({
            title: submission.title,
            description: submission.description,
            type: submission.type || 'project_submission',
            category: submission.category,
            projectId: submission.projectId || undefined,
            teamId: submission.teamId || currentTeam?.id || undefined,
            docsUrl: submission.docsUrl || undefined,
          }),
        'Project deliverable submitted for PM review',
      )
    },
    [currentTeam?.id, runApiMutation],
  )

  const handleAddComplaint = useCallback(
    (complaint: Report) => {
      setData((prev) => ({
        ...prev,
        reports: [complaint, ...prev.reports],
      }))

      void runApiMutation(
        () =>
          erpApi.createReport({
            title: complaint.title,
            description: complaint.description,
            type: complaint.type || 'complaint',
            category: complaint.category,
            teamId: complaint.teamId || currentTeam?.id || undefined,
            complainTo: complaint.complainTo,
            isConfidential: Boolean(complaint.isConfidential),
            confidentialTo: complaint.confidentialTo,
            targetUserId: complaint.targetUserId,
          }),
        'Grievance report submitted',
      )
    },
    [currentTeam?.id, runApiMutation],
  )

  const handleMarkNotificationRead = useCallback((notificationId: string) => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n,
      ),
    }))
    void erpApi.markNotificationRead(notificationId).catch(() => {})
  }, [])

  const handleMarkAllNotificationsRead = useCallback(() => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }))
    void erpApi.markAllNotificationsRead().catch(() => {})
    showToast('All notifications marked read', 'info')
  }, [showToast])

  // --- PM WORKSPACE HANDLERS ---

  const handleCreateTask = useCallback(
    (taskData: {
      title: string
      description?: string
      projectId: string
      assigneeId: string
      priority?: TaskPriority
      dueDate?: string
      estimatedHours?: number | string
      tags?: string[]
      checklist?: TaskChecklistItem[]
    }): Task => {
      const creatorId = currentUser?.id || currentPmId
      const newTask: Task = {
        id: `task_${Date.now()}`,
        title: taskData.title,
        description: taskData.description || '',
        projectId: taskData.projectId,
        assigneeId: taskData.assigneeId,
        creatorId,
        status: 'todo',
        priority: taskData.priority || 'medium',
        dueDate:
          taskData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        estimatedHours: Number(taskData.estimatedHours) || 8,
        loggedHours: 0,
        tags: taskData.tags || [],
        checklist: taskData.checklist || [],
        createdAt: new Date().toISOString().split('T')[0],
      }

      setData((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
      }))

      void runApiMutation(
        () =>
          erpApi.createTask({
            title: taskData.title,
            description: taskData.description || '',
            projectId: taskData.projectId,
            assigneeId: taskData.assigneeId,
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : undefined,
            estimatedHours: Number(taskData.estimatedHours) || 8,
            tags: taskData.tags || [],
            checklist: taskData.checklist?.map((c) => ({ text: c.text, completed: c.completed })),
          }),
        `Task "${newTask.title}" created successfully`,
      )

      return newTask
    },
    [currentUser?.id, currentPmId, runApiMutation],
  )

  const handleApproveTask = useCallback(
    (taskId: string, feedback?: string) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'completed' as TaskStatus } : t,
        ),
      }))
      void runApiMutation(
        () => erpApi.approveTask(taskId, { feedback }),
        'Task approved and marked as Completed',
      )
    },
    [runApiMutation],
  )

  const handleRejectTask = useCallback(
    (taskId: string, feedback: string) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'in_progress' as TaskStatus } : t,
        ),
      }))
      void runApiMutation(
        () => erpApi.rejectTask(taskId, feedback || 'Revisions requested'),
        'Task returned to In Progress with feedback',
      )
    },
    [runApiMutation],
  )

  const handleReassignTask = useCallback(
    (taskId: string, newAssigneeId: string) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, assigneeId: newAssigneeId } : t)),
      }))
      const devName = resolvers.getUser(newAssigneeId)?.name || 'developer'
      void runApiMutation(
        () => erpApi.reassignTask(taskId, newAssigneeId),
        `Task reassigned to ${devName}`,
      )
    },
    [resolvers, runApiMutation],
  )

  const handleAllocateBudget = useCallback(
    (allocation: {
      developerId: string
      projectId: string
      amount: number | string
      description?: string
      week?: number | string
    }) => {
      const allocAmount = Number(allocation.amount)
      if (isNaN(allocAmount) || allocAmount <= 0) {
        showToast('Please enter a valid positive allocation amount', 'error')
        return false
      }

      const project = data.projects.find((p) => p.id === allocation.projectId)
      if (!project) {
        showToast('Target project not found for budget allocation', 'error')
        return false
      }

      const remainingBudget = project.budget - (project.allocatedBudget || 0)
      if (allocAmount > remainingBudget) {
        showToast(
          `Allocation rejected: Project has ${formatBDT(remainingBudget)} remaining (${formatBDT(allocAmount)} requested)`,
          'error',
        )
        return false
      }

      const devName = resolvers.getUser(allocation.developerId)?.name || 'developer'
      void runApiMutation(
        () =>
          erpApi.allocateDeveloperBudget({
            developerId: allocation.developerId,
            projectId: allocation.projectId,
            amount: allocAmount,
            description: allocation.description,
            week: allocation.week ? Number(allocation.week) : undefined,
          }),
        `Successfully allocated ${formatBDT(allocAmount)} to ${devName}`,
      )
      return true
    },
    [data.projects, resolvers, runApiMutation, showToast],
  )

  const handleRequestBudgetIncrease = useCallback(
    (req: { projectId: string; amount: number | string; reason: string }) => {
      const amountNum = Number(req.amount)
      void runApiMutation(
        () =>
          erpApi.requestBudgetIncrease({
            projectId: req.projectId,
            amount: amountNum,
            reason: req.reason,
          }),
        `Budget request of ${formatBDT(amountNum)} submitted to CFO`,
      )
    },
    [runApiMutation],
  )

  const handleSubmitPmReport = useCallback(
    (report: {
      category: string
      recipient: string
      title: string
      description: string
      projectId?: string
      docsUrl?: string
    }) => {
      void runApiMutation(
        () =>
          erpApi.createReport({
            type: 'pm_report',
            category: report.category,
            recipient: report.recipient,
            title: report.title,
            description: report.description,
            projectId: report.projectId || undefined,
            teamId: currentTeam?.id || undefined,
            docsUrl: report.docsUrl || undefined,
          }),
        `Report submitted to ${report.recipient}`,
      )
    },
    [currentTeam?.id, runApiMutation],
  )

  const handleUpdatePmTaskStatus = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      }))
      void runApiMutation(
        () => erpApi.updateTaskStatus(taskId, newStatus),
        `Task status updated to ${newStatus.replace('_', ' ')}`,
      )
    },
    [runApiMutation],
  )

  const handleForwardSubmissionToCLevel = useCallback(
    (submissionId: string, recipient: string, endorsement: string) => {
      void runApiMutation(
        () => erpApi.forwardReport(submissionId, { recipient, endorsement }),
        `Project idea forwarded to ${recipient}`,
      )
    },
    [runApiMutation],
  )

  const handleAddProjectMilestone = useCallback(
    (projectId: string, milestoneData: { title: string; dueDate?: string; status?: string }) => {
      void runApiMutation(
        () =>
          erpApi.addMilestone(projectId, {
            title: milestoneData.title,
            dueDate: milestoneData.dueDate
              ? new Date(milestoneData.dueDate).toISOString()
              : undefined,
            status: milestoneData.status || 'pending',
          }),
        'New milestone added to project',
      )
    },
    [runApiMutation],
  )

  const handleUpdateMilestoneStatus = useCallback(
    (projectId: string, milestoneId: string, newStatus: string) => {
      void runApiMutation(
        () => erpApi.updateMilestoneStatus(projectId, milestoneId, newStatus),
        `Milestone status updated to "${newStatus.replace('_', ' ')}"`,
      )
    },
    [runApiMutation],
  )

  const handleUpdateComplaintStatus = useCallback(
    (complaintId: string, newStatus: string, pmComment?: string) => {
      void runApiMutation(
        () => erpApi.updateReportStatus(complaintId, { status: newStatus, feedback: pmComment }),
        `Complaint updated to "${newStatus.replace('_', ' ')}"`,
      )
    },
    [runApiMutation],
  )

  const handleUpdatePmProfile = useCallback(
    (updatedFields: Partial<User>) => {
      void runApiMutation(
        () =>
          erpApi.updateEmployee(currentPmId, {
            name: updatedFields.name,
            title: updatedFields.title,
            skills: updatedFields.skills,
            bio: updatedFields.bio,
            timezone: updatedFields.timezone,
            avatarUrl: updatedFields.avatarUrl || updatedFields.avatar,
          }),
        'PM profile updated successfully',
      )
    },
    [currentPmId, runApiMutation],
  )

  // --- CTO / EXECUTIVE WORKSPACE HANDLERS ---

  const handleCreateCtoEngineeringTask = useCallback(
    (taskData: {
      title: string
      description?: string
      projectId: string
      pmId: string
      priority?: TaskPriority
      dueDate?: string
      estimatedHours?: number | string
      tags?: string[]
    }): Task => {
      const creatorId = currentUser?.id || 'emp_cto_01'
      const newTask: Task = {
        id: `task_cto_${Date.now()}`,
        title: taskData.title,
        description: taskData.description || '',
        projectId: taskData.projectId,
        assigneeId: taskData.pmId,
        creatorId,
        status: 'todo',
        priority: taskData.priority || 'high',
        dueDate:
          taskData.dueDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        estimatedHours: Number(taskData.estimatedHours) || 8,
        loggedHours: 0,
        tags: taskData.tags || ['Engineering Task', 'CTO Mandate'],
        createdAt: new Date().toISOString().split('T')[0],
      }

      setData((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
      }))

      void runApiMutation(
        () =>
          erpApi.createTask({
            title: taskData.title,
            description: taskData.description || '',
            projectId: taskData.projectId,
            assigneeId: taskData.pmId,
            priority: taskData.priority || 'high',
            dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : undefined,
            estimatedHours: Number(taskData.estimatedHours) || 8,
            tags: taskData.tags || ['Engineering Task', 'CTO Mandate'],
          }),
        'Engineering task created and assigned to PM',
      )

      return newTask
    },
    [currentUser?.id, runApiMutation],
  )

  const handleReviewCtoTaskSubmission = useCallback(
    (taskId: string, approved: boolean, feedback?: string) => {
      if (approved) {
        void runApiMutation(
          () => erpApi.approveTask(taskId, { feedback }),
          'Deliverable approved & completed by CTO',
        )
      } else {
        void runApiMutation(
          () => erpApi.rejectTask(taskId, feedback || 'Revisions requested by CTO'),
          'Revisions requested from PM',
        )
      }
    },
    [runApiMutation],
  )

  const handleUpdateCtoPersonalTaskStatus = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      }))
      void runApiMutation(
        () => erpApi.updateTaskStatus(taskId, newStatus),
        `Task moved to ${newStatus.replace('_', ' ')}`,
      )
    },
    [runApiMutation],
  )

  const handleCreateCtoPersonalTask = useCallback(
    (taskData: {
      title: string
      description?: string
      priority?: TaskPriority
      dueDate?: string
      tags?: string[]
      projectId?: string
    }): Task => {
      const actorId = currentUser?.id || 'emp_cto_01'
      const projId = taskData.projectId || data.projects[0]?.id || 'proj_01'
      const newTask: Task = {
        id: `task_${currentRole}_${Date.now()}`,
        title: taskData.title,
        description: taskData.description || '',
        projectId: projId,
        assigneeId: actorId,
        assignedTo: actorId,
        creatorId: actorId,
        status: 'todo',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        estimatedHours: 8,
        loggedHours: 0,
        tags: taskData.tags || ['Personal', 'Executive'],
        createdAt: new Date().toISOString(),
      }

      setData((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
      }))

      void runApiMutation(
        () =>
          erpApi.createTask({
            title: taskData.title,
            description: taskData.description || '',
            projectId: projId,
            assigneeId: actorId,
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : undefined,
            tags: taskData.tags || ['Personal', 'Executive'],
          }),
        'Personal task added to board',
      )

      return newTask
    },
    [currentUser?.id, currentRole, data.projects, runApiMutation],
  )

  const handleCreateProject = useCallback(
    (projectData: {
      name: string
      code: string
      teamId?: string
      budget?: number
      deadline?: string
      description?: string
      repositoryUrl?: string
      srsUrl?: string
      tags?: string[]
    }): Project => {
      const newId = `proj_${Date.now()}`
      const optimistic: Project = {
        id: newId,
        name: projectData.name,
        code: projectData.code,
        teamId: projectData.teamId || 'team_01',
        pmId: 'emp_pm_01',
        progress: 0,
        health: 'on_track',
        totalWeeks: 5,
        currentWeek: 1,
        assignedDevIds: [],
        budget: projectData.budget ?? 0,
        startDate: new Date().toISOString().split('T')[0],
        deadline:
          projectData.deadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'in_progress',
        tags: projectData.tags || ['React', 'TypeScript'],
        description: projectData.description || 'New strategic engineering project',
        repositoryUrl: projectData.repositoryUrl,
      }

      setData((prev) => ({
        ...prev,
        projects: [optimistic, ...prev.projects],
      }))

      void runApiMutation(
        () =>
          erpApi.createProject({
            name: projectData.name,
            code: projectData.code,
            description: projectData.description || 'New strategic engineering project',
            teamId: projectData.teamId || 'team_01',
            budget: projectData.budget ?? 0,
            deadline: projectData.deadline
              ? new Date(projectData.deadline).toISOString()
              : undefined,
            repositoryUrl: projectData.repositoryUrl,
            srsUrl: projectData.srsUrl,
            tags: projectData.tags || ['React', 'TypeScript'],
          }),
        `Project ${projectData.code} created successfully`,
      )

      return optimistic
    },
    [runApiMutation],
  )

  const handleUpdateProject = useCallback(
    (
      projectId: string,
      updates: Partial<Project> & { repositoryUrl?: string; srsUrl?: string },
    ) => {
      const payload: Record<string, unknown> = {}
      if (updates.name !== undefined) payload.name = updates.name
      if (updates.description !== undefined) payload.description = updates.description
      if (updates.status !== undefined) payload.status = updates.status
      if (updates.progress !== undefined) payload.progress = updates.progress
      if (updates.health !== undefined) payload.health = updates.health
      if (updates.deadline !== undefined)
        payload.deadline = new Date(updates.deadline).toISOString()
      if (updates.repositoryUrl !== undefined) payload.repositoryUrl = updates.repositoryUrl
      if (updates.demoUrl !== undefined) payload.demoUrl = updates.demoUrl
      if (updates.tags !== undefined) payload.tags = updates.tags
      if (updates.srsUrl !== undefined) payload.srsUrl = updates.srsUrl

      void runApiMutation(async () => {
        if (Object.keys(payload).length > 0) {
          await erpApi.updateProject(projectId, payload)
        }
        if (updates.teamId) {
          await erpApi.assignProjectTeam(projectId, updates.teamId)
        }
      }, 'Project updated successfully')
    },
    [runApiMutation],
  )

  const handleUpdateUser = useCallback(
    (userId: string, updates: Partial<User>) => {
      void runApiMutation(async () => {
        const empUpdates: Record<string, unknown> = {}
        if (updates.name !== undefined) empUpdates.name = updates.name
        if (updates.title !== undefined) empUpdates.title = updates.title
        if (updates.status !== undefined) empUpdates.status = updates.status
        if (updates.skills !== undefined) empUpdates.skills = updates.skills
        if (updates.bio !== undefined) empUpdates.bio = updates.bio
        if (Object.keys(empUpdates).length > 0) {
          await erpApi.updateEmployee(userId, empUpdates)
        }

        if (updates.teamId) {
          await erpApi.addTeamMember(updates.teamId, { employeeId: userId, isLead: false })
        }

        if (updates.role) {
          const targetRoleCat = updates.role === 'cpo' ? 'chro' : updates.role
          const freePos = positionsRef.current.find(
            (p) =>
              p.roleCategory === targetRoleCat &&
              (!p.assignments || !p.assignments.some((a: any) => a.isActive)),
          )
          if (freePos) {
            await erpApi.assignPosition({ employeeId: userId, positionId: freePos.id })
          }
        }
      }, 'Member profile updated')
    },
    [runApiMutation],
  )

  const handleCreateTeam = useCallback(
    (teamData: {
      name: string
      code: string
      focus: string
      pmId?: string
      leadDevId?: string
      memberIds?: string[]
      projectIds?: string[]
      weeklyVelocity?: number
    }): Team => {
      const optimistic: Team = {
        id: `team_${Date.now()}`,
        name: teamData.name,
        code: teamData.code,
        focus: teamData.focus,
        pmId: teamData.pmId || '',
        leadDevId: teamData.leadDevId || '',
        memberIds: teamData.memberIds || [],
        projectIds: teamData.projectIds || [],
        weeklyVelocity: teamData.weeklyVelocity || 40,
      }

      void runApiMutation(
        () =>
          erpApi.createTeam({
            name: teamData.name,
            code: teamData.code,
            focus: teamData.focus,
            ...(teamData.pmId ? { pmEmployeeId: teamData.pmId } : {}),
            weeklyVelocity: teamData.weeklyVelocity || 40,
          }),
        `Squad ${teamData.name} created`,
      )

      return optimistic
    },
    [runApiMutation],
  )

  const handleUpdateTeam = useCallback(
    (teamId: string, updates: Partial<Team>) => {
      void runApiMutation(async () => {
        const teamPayload: Record<string, unknown> = {}
        if (updates.name !== undefined) teamPayload.name = updates.name
        if (updates.focus !== undefined) teamPayload.focus = updates.focus
        if (updates.pmId !== undefined) teamPayload.pmEmployeeId = updates.pmId || null
        if (updates.color !== undefined) teamPayload.color = updates.color
        if (updates.health !== undefined) teamPayload.health = updates.health
        if (updates.weeklyVelocity !== undefined)
          teamPayload.weeklyVelocity = updates.weeklyVelocity
        if (updates.currentSprintWeek !== undefined)
          teamPayload.currentSprintWeek = updates.currentSprintWeek
        if (Object.keys(teamPayload).length > 0) {
          await erpApi.updateTeam(teamId, teamPayload)
        }
        if (updates.leadDevId) {
          await erpApi.addTeamMember(teamId, { employeeId: updates.leadDevId, isLead: true })
        }
      }, 'Squad updated successfully')
    },
    [runApiMutation],
  )

  const handleReviewProjectIdea = useCallback(
    (ideaId: string, status: string, feedback?: string) => {
      void runApiMutation(
        () => erpApi.updateReportStatus(ideaId, { status, feedback }),
        `Project idea status set to "${status.replace('_', ' ')}"`,
      )
    },
    [runApiMutation],
  )

  const handleUpdateComplaintStatusGeneral = useCallback(
    (complaintId: string, status: string, feedback?: string) => {
      void runApiMutation(
        () => erpApi.updateReportStatus(complaintId, { status, feedback }),
        `Complaint updated to "${status.replace('_', ' ')}"`,
      )
    },
    [runApiMutation],
  )

  const handleUpdateRepoConfig = useCallback(
    (
      projectId: string,
      updates: { repositoryUrl?: string; defaultBranch?: string; tags?: string[]; srsUrl?: string },
    ) => {
      void runApiMutation(
        () =>
          erpApi.updateProject(projectId, {
            repositoryUrl: updates.repositoryUrl,
            tags: updates.tags,
            srsUrl: updates.srsUrl,
          }),
        'Technical configuration and repository details updated',
      )
    },
    [runApiMutation],
  )

  const handleReviewPullRequest = useCallback(
    (prId: string, newStatus: 'approved' | 'merged' | 'changes_requested') => {
      setData((prev) => ({
        ...prev,
        pullRequests: prev.pullRequests.map((pr) =>
          pr.id === prId ? { ...pr, status: newStatus } : pr,
        ),
      }))
      showToast(`Pull request ${newStatus.replace('_', ' ')}`, 'success')
    },
    [showToast],
  )

  const handleCreateSecurityIssue = useCallback(
    (issue: {
      title: string
      projectId: string
      severity: 'critical' | 'high' | 'medium' | 'low'
      category: 'dependency' | 'auth' | 'injection' | 'encryption' | 'infrastructure'
      assignedPmId?: string
      description: string
      recommendation: string
      cveOrPackage?: string
    }) => {
      void runApiMutation(
        () => erpApi.createSecurityAlert(issue),
        'Security issue logged and escalated to squad PM',
      )
    },
    [runApiMutation],
  )

  const handleUpdateSecurityIssueStatus = useCallback(
    (issueId: string, newStatus: 'open' | 'investigating' | 'patch_in_progress' | 'resolved') => {
      void runApiMutation(
        () => erpApi.updateSecurityAlertStatus(issueId, newStatus),
        `Security issue status set to ${newStatus.replace('_', ' ')}`,
      )
    },
    [runApiMutation],
  )

  const handleUpdateConsultancyStatus = useCallback(
    (
      requestId: string,
      updates: {
        status:
          | 'submitted'
          | 'under_review'
          | 'accepted'
          | 'assigned'
          | 'in_progress'
          | 'completed'
          | 'rejected'
        assignedConsultantName?: string
        feeBDT?: number
        targetDate?: string
        ctoNotes?: string
      },
    ) => {
      void runApiMutation(
        () =>
          erpApi.updateConsultancy(requestId, {
            status: updates.status,
            assignedConsultantName: updates.assignedConsultantName,
            feeBDT: updates.feeBDT,
            targetDate: updates.targetDate,
            ctoNotes: updates.ctoNotes,
          }),
        `Consultancy request updated to "${updates.status}"`,
      )
    },
    [runApiMutation],
  )

  const handleSubmitCtoReport = useCallback(
    (report: {
      category: string
      recipient: string
      title: string
      description: string
      projectId?: string
      docsUrl?: string
    }) => {
      void runApiMutation(
        () =>
          erpApi.createReport({
            type: 'cto_report',
            category: report.category,
            recipient: report.recipient,
            title: report.title,
            description: report.description,
            projectId: report.projectId,
            docsUrl: report.docsUrl,
          }),
        `Executive engineering report submitted to ${report.recipient}`,
      )
    },
    [runApiMutation],
  )

  const handleUpdateIncomingReportStatus = useCallback(
    (reportId: string, newStatus: string, feedback?: string, forwardTo?: string) => {
      void runApiMutation(
        async () => {
          if (forwardTo) {
            await erpApi.forwardReport(reportId, {
              recipient: forwardTo,
              endorsement: feedback || 'Forwarded for executive review',
            })
          } else {
            await erpApi.updateReportStatus(reportId, { status: newStatus, feedback })
          }
        },
        `Report updated: "${newStatus.replace('_', ' ')}"`,
      )
    },
    [runApiMutation],
  )

  const handleUpdateCtoProfile = useCallback(
    (updatedFields: Partial<User>) => {
      const ctoUser = data.users.find((u) => u.role === 'cto')
      const ctoId = ctoUser?.id || 'emp_cto_01'
      void runApiMutation(
        () =>
          erpApi.updateEmployee(ctoId, {
            name: updatedFields.name,
            title: updatedFields.title,
            skills: updatedFields.skills,
            bio: updatedFields.bio,
            timezone: updatedFields.timezone,
            avatarUrl: updatedFields.avatarUrl || updatedFields.avatar,
          }),
        'CTO profile updated successfully',
      )
    },
    [data.users, runApiMutation],
  )

  // --- CFO FINANCIAL HANDLERS ---

  const handleAllocateProjectBudget = useCallback(
    (projectId: string, newBudget: number, reason?: string) => {
      if (newBudget <= 0) {
        showToast('Project budget must be greater than ৳0', 'error')
        return
      }

      void runApiMutation(
        () => erpApi.allocateProjectBudget({ projectId, newBudget, reason }),
        `Updated project budget pool to ${formatBDT(newBudget)}`,
      )
    },
    [runApiMutation, showToast],
  )

  const handleApproveBudgetRequest = useCallback(
    (reportId: string, approvedAmount: number, feedback?: string) => {
      void runApiMutation(
        () => erpApi.approveBudgetRequest(reportId, { approvedAmount, feedback }),
        `Approved +${formatBDT(approvedAmount)} budget increase`,
      )
    },
    [runApiMutation],
  )

  const handleRejectBudgetRequest = useCallback(
    (reportId: string, feedback: string) => {
      void runApiMutation(
        () => erpApi.rejectBudgetRequest(reportId, feedback || 'Budget request dismissed by CFO.'),
        'Budget request dismissed',
      )
    },
    [runApiMutation],
  )

  const handleIssueFinancialAdjustment = useCallback(
    (userId: string, amount: number, type: 'bonus' | 'penalty', reason: string) => {
      const targetUser = data.users.find((u) => u.id === userId)
      void runApiMutation(
        () => erpApi.issueFinancialAdjustment({ userId, amount, type, reason }),
        `Issued ${formatBDT(amount)} ${type} to ${targetUser?.name || userId}`,
      )
    },
    [data.users, runApiMutation],
  )

  // --- CHRO HANDLERS ---

  const handleRecordPerformanceEvaluation = useCallback(
    (
      userId: string,
      evaluation: {
        score: number
        tier: 'top_performer' | 'strong_contributor' | 'needs_support' | string
        notes: string
        strengths?: string[]
        improvementAreas?: string[]
      },
    ) => {
      const targetUser = data.users.find((u) => u.id === userId)
      void runApiMutation(
        () =>
          erpApi.recordEvaluation({
            userId,
            score: evaluation.score,
            tier: evaluation.tier,
            notes: evaluation.notes,
            strengths: evaluation.strengths,
            improvementAreas: evaluation.improvementAreas,
          }),
        `Evaluation recorded for ${targetUser?.name || userId}`,
      )
    },
    [data.users, runApiMutation],
  )

  const handleIssueEmployeeRecognition = useCallback(
    (userId: string, title: string, description: string, bonusAmount?: number) => {
      const targetUser = data.users.find((u) => u.id === userId)
      void runApiMutation(
        () =>
          erpApi.issueRecognition({
            userId,
            title,
            description,
            bonusAmount: bonusAmount && bonusAmount > 0 ? bonusAmount : undefined,
          }),
        `Awarded "${title}" to ${targetUser?.name || userId}`,
      )
    },
    [data.users, runApiMutation],
  )

  const handleIssueDisciplinaryAction = useCallback(
    (userId: string, title: string, description: string, penaltyAmount?: number) => {
      const targetUser = data.users.find((u) => u.id === userId)
      void runApiMutation(
        () =>
          erpApi.issueDisciplinary({
            userId,
            title,
            description,
            penaltyAmount: penaltyAmount && penaltyAmount > 0 ? penaltyAmount : undefined,
          }),
        `Disciplinary action recorded for ${targetUser?.name || userId}`,
      )
    },
    [data.users, runApiMutation],
  )

  const handleUpdateConfidentialComplaintStatus = useCallback(
    (complaintId: string, status: string, mediationNotes?: string) => {
      void runApiMutation(
        () =>
          erpApi.adjudicateConfidential(complaintId, {
            status,
            mediationNotes: mediationNotes || `Status updated to ${status}`,
          }),
        `Confidential grievance updated to "${status}"`,
      )
    },
    [runApiMutation],
  )

  // --- EXECUTIVE MANAGEMENT HANDLERS ---

  const handleUpdateExecutiveProfile = useCallback(
    (roleId: string, updatedFields: Partial<User>) => {
      const normalized = roleId === 'chro' ? 'cpo' : roleId
      const target = data.users.find((u) => u.role === normalized || u.role === roleId)
      if (!target) return

      void runApiMutation(
        () =>
          erpApi.updateEmployee(target.id, {
            name: updatedFields.name,
            title: updatedFields.title,
            skills: updatedFields.skills,
            bio: updatedFields.bio,
            timezone: updatedFields.timezone,
            avatarUrl: updatedFields.avatarUrl || updatedFields.avatar,
          }),
        'Executive profile updated successfully',
      )
    },
    [data.users, runApiMutation],
  )

  const handleCreateExecutiveDirective = useCallback(
    (directive: {
      title: string
      description?: string
      assigneeRole: string
      assigneeId?: string
      priority?: TaskPriority
      dueDate?: string
      tags?: string[]
      projectId?: string
    }): Task => {
      const targetRole = directive.assigneeRole === 'cpo' ? 'chro' : directive.assigneeRole
      const targetUserId =
        directive.assigneeId ||
        data.users.find((u) => u.role === targetRole || u.role === directive.assigneeRole)?.id ||
        currentDevId

      const newTask: Task = {
        id: `tsk_exec_${Date.now()}`,
        title: directive.title,
        description:
          directive.description || 'Executive strategic directive issued from C-Suite leadership.',
        status: 'todo',
        priority: directive.priority || 'urgent',
        assigneeId: targetUserId,
        assignedTo: targetUserId,
        creatorId: currentUser?.id || 'emp_ceo_01',
        projectId: directive.projectId || data.projects[0]?.id || 'proj_01',
        dueDate: directive.dueDate || '2026-11-30',
        tags: directive.tags || ['Executive Directive', directive.assigneeRole.toUpperCase()],
        estimatedHours: 24,
        loggedHours: 0,
        createdAt: new Date().toISOString(),
      }

      setData((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
      }))

      void runApiMutation(
        () =>
          erpApi.dispatchDirective({
            title: directive.title,
            description: directive.description,
            assigneeRole: targetRole,
            assigneeId: directive.assigneeId,
            priority: directive.priority || 'urgent',
            dueDate: directive.dueDate ? new Date(directive.dueDate).toISOString() : undefined,
            tags: directive.tags,
            projectId: directive.projectId || data.projects[0]?.id,
          }),
        `Executive directive dispatched to ${directive.assigneeRole.toUpperCase()}`,
      )

      return newTask
    },
    [currentDevId, currentUser?.id, data.projects, data.users, runApiMutation],
  )

  const handleAuthorizeCeoAction = useCallback(
    (actionType: string, entityId: string, notes?: string) => {
      void runApiMutation(
        () => erpApi.ratifyDecision({ actionType, entityId, notes }),
        `CEO Authorized: ${actionType.replace(/_/g, ' ').toUpperCase()}`,
      )
    },
    [runApiMutation],
  )

  const activeDelegationsCount = useMemo(() => {
    const grants = authzSnapshot?.grants || []
    const nowMs = Date.now()
    const ids = new Set<string>()
    for (const g of grants) {
      if (g.sourceType !== 'delegation') continue
      if (g.expiresAt && new Date(g.expiresAt).getTime() <= nowMs) continue
      ids.add(g.sourceId)
    }
    return ids.size
  }, [authzSnapshot?.grants])

  const value: AppContextType = {
    data,
    currentRole,
    currentDevId,
    currentPmId,
    currentRoute,
    theme,
    isSidebarCollapsed,
    searchQuery,
    isSearchOpen,
    selectedTaskModal,
    selectedProjectModal,
    toastMessage,
    currentUser,
    currentTeam,
    rolePermissions,
    myPermissions,
    directPermissions,
    authzSnapshot,
    pendingApprovalsCount,
    activeDelegationsCount,
    recentRoutes,
    resolvers,

    setRole: handleSetRole,
    setPmId: handleSetPmId,
    setRoute,
    toggleTheme,
    toggleSidebar: () => setIsSidebarCollapsed((prev) => !prev),
    setSidebarCollapsed: setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setMobileSidebarOpen: setIsMobileSidebarOpen,
    isAuthenticated: Boolean(authUser),
    mustChangePassword: Boolean(authUser?.mustChangePassword),
    mustEnrollMfa: Boolean(authUser?.mustEnrollMfa),
    completeFirstLoginSetup: async () => {
      const me = await erpApi.getAuthMe()
      setAuthUser(me)
      if (!me.mustChangePassword && !me.mustEnrollMfa) {
        const normRole = me.role === 'chro' ? 'cpo' : me.role
        await syncFromBackend(normRole, me.id)
      }
    },
    isAuthChecking,
    isDataLoading,
    loginWithCredentials,
    completeGoogleLogin,
    logout,
    hasPermission,
    hasAnyPermission,
    can,
    canAny,
    setSearchQuery,
    setIsSearchOpen,
    setSelectedTaskModal,
    setSelectedProjectModal,
    updateTaskStatus: handleUpdateTaskStatus,
    addTaskComment: handleAddTaskComment,
    updateUserProfile: handleUpdateUserProfile,
    addSubmission: handleAddSubmission,
    addComplaint: handleAddComplaint,
    markNotificationRead: handleMarkNotificationRead,
    markAllNotificationsRead: handleMarkAllNotificationsRead,
    refreshData: () => syncFromBackend(),
    refreshPermissions: refreshAccessProfile,
    showToast,

    createTask: handleCreateTask,
    approveTask: handleApproveTask,
    rejectTask: handleRejectTask,
    reassignTask: handleReassignTask,
    allocateBudget: handleAllocateBudget,
    requestBudgetIncrease: handleRequestBudgetIncrease,
    submitPmReport: handleSubmitPmReport,
    updatePmTaskStatus: handleUpdatePmTaskStatus,
    forwardSubmissionToCLevel: handleForwardSubmissionToCLevel,
    addProjectMilestone: handleAddProjectMilestone,
    updateMilestoneStatus: handleUpdateMilestoneStatus,
    updatePmProfile: handleUpdatePmProfile,
    updateComplaintStatus: handleUpdateComplaintStatus,

    createCtoPersonalTask: handleCreateCtoPersonalTask,
    createCtoEngineeringTask: handleCreateCtoEngineeringTask,
    reviewCtoTaskSubmission: handleReviewCtoTaskSubmission,
    updateCtoPersonalTaskStatus: handleUpdateCtoPersonalTaskStatus,
    createProject: handleCreateProject,
    updateProject: handleUpdateProject,
    updateUser: handleUpdateUser,
    createTeam: handleCreateTeam,
    updateTeam: handleUpdateTeam,
    reviewProjectIdea: handleReviewProjectIdea,
    updateComplaintStatusGeneral: handleUpdateComplaintStatusGeneral,
    updateRepoConfig: handleUpdateRepoConfig,
    reviewPullRequest: handleReviewPullRequest,
    createSecurityIssue: handleCreateSecurityIssue,
    updateSecurityIssueStatus: handleUpdateSecurityIssueStatus,
    updateConsultancyStatus: handleUpdateConsultancyStatus,
    submitCtoReport: handleSubmitCtoReport,
    updateIncomingReportStatus: handleUpdateIncomingReportStatus,
    updateCtoProfile: handleUpdateCtoProfile,

    allocateProjectBudget: handleAllocateProjectBudget,
    approveBudgetRequest: handleApproveBudgetRequest,
    rejectBudgetRequest: handleRejectBudgetRequest,
    issueFinancialAdjustment: handleIssueFinancialAdjustment,

    recordPerformanceEvaluation: handleRecordPerformanceEvaluation,
    issueEmployeeRecognition: handleIssueEmployeeRecognition,
    issueDisciplinaryAction: handleIssueDisciplinaryAction,
    updateConfidentialComplaintStatus: handleUpdateConfidentialComplaintStatus,

    updateExecutiveProfile: handleUpdateExecutiveProfile,
    createExecutiveDirective: handleCreateExecutiveDirective,
    authorizeCeoAction: handleAuthorizeCeoAction,
  }

  void (null as unknown as ProjectMilestone | ActivityLog | null)

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useApp(): AppContextType {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export { AppContext }
