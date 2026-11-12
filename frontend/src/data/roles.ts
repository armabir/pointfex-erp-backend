import type { Role } from '../types'

export const ROLES: Record<string, Role> = {
  DEVELOPER: {
    id: 'developer',
    name: 'Developer',
    badge: 'Dev Workspace',
    description: 'Execute tasks, submit sprint deliverables, track performance, and report to PM.',
    isImplemented: true,
  },
  PM: {
    id: 'pm',
    name: 'Project Manager (PM)',
    badge: 'Management',
    description:
      'Manage sprints, allocate tasks to 4-dev teams, review deliverables, and approve milestones.',
    isImplemented: true,
  },
  CTO: {
    id: 'cto',
    name: 'Chief Technology Officer (CTO)',
    badge: 'Executive',
    description:
      'Oversee architectural standards, cross-team tech stacks, code quality, and engineering velocity.',
    isImplemented: true,
  },
  CPO: {
    id: 'cpo',
    name: 'Chief Human Resources Officer (CHRO)',
    badge: 'Executive',
    description:
      'Employee performance evaluations, team dynamics, attendance, morale, and confidential grievance adjudication.',
    isImplemented: true,
  },
  CFO: {
    id: 'cfo',
    name: 'Chief Financial Officer (CFO)',
    badge: 'Executive',
    description:
      'Company treasury, team & project budget allocations, financial transactions, and revenue-sharing management.',
    isImplemented: true,
  },
  CEO: {
    id: 'ceo',
    name: 'Chief Executive Officer (CEO)',
    badge: 'Executive',
    description:
      'Company-wide executive command, strategic decisions authorization, cross-division governance, and corporate radar.',
    isImplemented: true,
  },
}

export const ROLE_LIST: Role[] = Object.values(ROLES)
