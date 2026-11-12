export interface AuthenticatedUser {
  id: string
  employeeId?: string
  email?: string
  name?: string
  role: string
  permissions?: string[]
  mustChangePassword?: boolean
  mustEnrollMfa?: boolean
}
