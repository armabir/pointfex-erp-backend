export interface AuthenticatedUser {
  id: string
  employeeId?: string
  email?: string
  name?: string
  role: string
  roles?: string[]
  permissions?: string[]
  mustChangePassword?: boolean
  mustEnrollMfa?: boolean
}
