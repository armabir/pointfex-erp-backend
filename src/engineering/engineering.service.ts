import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  CreateSecurityAlertDto,
  UpdateSecurityAlertStatusDto,
} from './dto/engineering.dto'
import { DemoUser } from '../common/demo-identity.guard'

@Injectable()
export class EngineeringService {
  constructor(private prisma: PrismaService) {}

  // Code Quality Gates
  async getQualityGates() {
    return this.prisma.codeQualityRecord.findMany({
      include: { project: true },
      orderBy: { complianceScore: 'desc' },
    })
  }

  async getQualityGateForProject(projectId: string) {
    const record = await this.prisma.codeQualityRecord.findUnique({
      where: { projectId },
      include: { project: true },
    })
    if (!record) {
      throw new NotFoundException(`Quality gate for project "${projectId}" not found`)
    }
    return record
  }

  // Security Alerts
  async getSecurityAlerts(projectId?: string, severity?: string, status?: string) {
    const where: any = {}
    if (projectId) where.projectId = projectId
    if (severity) where.severity = severity
    if (status) where.status = status

    return this.prisma.securityAlert.findMany({
      where,
      include: { project: true },
      orderBy: { detectedAt: 'desc' },
    })
  }

  async createSecurityAlert(dto: CreateSecurityAlertDto, actor: DemoUser) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } })
    if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

    const alertId = `sec_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.securityAlert.create({
        data: {
          id: alertId,
          projectId: dto.projectId,
          title: dto.title,
          severity: dto.severity,
          category: dto.category,
          status: 'open',
          assignedPmId: dto.assignedPmId,
          cveOrPackage: dto.cveOrPackage,
          description: dto.description,
          recommendation: dto.recommendation,
        },
        include: { project: true },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'SECURITY_ALERT_LOGGED',
          actionCode: 'SECURITY_VULNERABILITY_FLAGGED',
          severity: dto.severity === 'critical' ? 'CRITICAL' : 'WARNING',
          entityType: 'security',
          entityId: alertId,
          entityTitle: dto.title,
          description: `Logged ${dto.severity.toUpperCase()} security alert on project ${project.name}`,
          category: 'security',
          badgeColor: 'rose',
        },
      })

      return alert
    })
  }

  async updateSecurityAlertStatus(id: string, dto: UpdateSecurityAlertStatusDto, actor: DemoUser) {
    const alert = await this.prisma.securityAlert.findUnique({
      where: { id },
      include: { project: true },
    })
    if (!alert) throw new NotFoundException(`Security alert "${id}" not found`)

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.securityAlert.update({
        where: { id },
        data: {
          status: dto.status,
          resolvedAt: dto.status === 'resolved' ? new Date() : undefined,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'SECURITY_ALERT_STATUS_UPDATED',
          actionCode: 'SECURITY_STATUS_CHANGED',
          severity: dto.status === 'resolved' ? 'SUCCESS' : 'INFO',
          entityType: 'security',
          entityId: id,
          entityTitle: alert.title,
          description: `Updated status of alert "${alert.title}" to ${dto.status}`,
          category: 'security',
          badgeColor: dto.status === 'resolved' ? 'emerald' : 'amber',
        },
      })

      return updated
    })
  }

  // Test Runs
  async getTestRuns(projectId?: string) {
    const where: any = {}
    if (projectId) where.projectId = projectId

    return this.prisma.testRun.findMany({
      where,
      include: { project: true },
      orderBy: { lastRun: 'desc' },
    })
  }
}

