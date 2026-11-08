import { Test, TestingModule } from '@nestjs/testing'
import { TeamsService } from './teams.service'
import { PrismaService } from '../common/prisma.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

describe('TeamsService - Squad Organizational Binding & PM Validation', () => {
  let service: TeamsService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      team: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      position: {
        findUnique: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      teamMembership: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<TeamsService>(TeamsService)
  })

  describe('PM Position Validation Rules', () => {
    it('should reject team creation if position is not a Project Manager position', async () => {
      // Developer position passed instead of PM
      prisma.position.findUnique.mockResolvedValue({
        id: 'pos_dev_01',
        code: 'DEV-01',
        roleCategory: 'developer',
      })

      await expect(
        service.create({
          name: 'Team Zulu',
          code: 'TZ',
          focus: 'Platform R&D',
          pmPositionId: 'pos_dev_01',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject team creation if PM position is already assigned to another active team', async () => {
      prisma.position.findUnique.mockResolvedValue({
        id: 'pos_pm_01',
        code: 'PM-01',
        roleCategory: 'pm',
      })
      prisma.team.findUnique.mockResolvedValue({
        id: 'team_01',
        name: 'Team Alpha',
        pmPositionId: 'pos_pm_01',
      })

      await expect(
        service.create({
          name: 'Team Zulu',
          code: 'TZ',
          focus: 'Platform R&D',
          pmPositionId: 'pos_pm_01',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should successfully create team when given a free PM position', async () => {
      prisma.position.findUnique.mockResolvedValue({
        id: 'pos_pm_06',
        code: 'PM-06',
        roleCategory: 'pm',
      })
      prisma.team.findUnique.mockResolvedValue(null)
      prisma.team.create.mockResolvedValue({
        id: 'team_06',
        name: 'Team Foxtrot',
        pmPositionId: 'pos_pm_06',
      })

      const res = await service.create({
        name: 'Team Foxtrot',
        code: 'TF',
        focus: 'Media Systems',
        pmPositionId: 'pos_pm_06',
      })

      expect(res.name).toBe('Team Foxtrot')
    })
  })
})
