import { Reflector } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { ThrottlerGuard, type ThrottlerStorage, type ThrottlerRequest } from '@nestjs/throttler'
import { ProxyThrottlerGuard } from './proxy-throttler.guard'

describe('ProxyThrottlerGuard', () => {
  const storageStub: ThrottlerStorage = {
    increment: jest.fn(),
  }

  function createGuard(configValue?: boolean | string): ProxyThrottlerGuard {
    const guard = new ProxyThrottlerGuard([], storageStub, new Reflector())
    if (configValue !== undefined) {
      ;(guard as unknown as { configService: ConfigService }).configService = {
        get: jest.fn().mockReturnValue(configValue),
      } as unknown as ConfigService
    }
    return guard
  }

  afterEach(() => {
    delete process.env.THROTTLE_BYPASS
    jest.restoreAllMocks()
  })

  it('bypasses rate limiting immediately when THROTTLE_BYPASS is true in ConfigService', async () => {
    const guard = createGuard(true)
    const superSpy = jest
      .spyOn(ThrottlerGuard.prototype as unknown as { handleRequest: jest.Mock }, 'handleRequest')
      .mockResolvedValue(false)

    const allowed = await (
      guard as unknown as { handleRequest: (req: ThrottlerRequest) => Promise<boolean> }
    ).handleRequest({} as ThrottlerRequest)

    expect(allowed).toBe(true)
    expect(superSpy).not.toHaveBeenCalled()
  })

  it('bypasses rate limiting when process.env.THROTTLE_BYPASS === "true"', async () => {
    process.env.THROTTLE_BYPASS = 'true'
    const guard = createGuard()
    const superSpy = jest
      .spyOn(ThrottlerGuard.prototype as unknown as { handleRequest: jest.Mock }, 'handleRequest')
      .mockResolvedValue(false)

    const allowed = await (
      guard as unknown as { handleRequest: (req: ThrottlerRequest) => Promise<boolean> }
    ).handleRequest({} as ThrottlerRequest)

    expect(allowed).toBe(true)
    expect(superSpy).not.toHaveBeenCalled()
  })

  it('delegates to super.handleRequest when THROTTLE_BYPASS is false', async () => {
    const guard = createGuard(false)
    const superSpy = jest
      .spyOn(ThrottlerGuard.prototype as unknown as { handleRequest: jest.Mock }, 'handleRequest')
      .mockResolvedValue(true)

    const allowed = await (
      guard as unknown as { handleRequest: (req: ThrottlerRequest) => Promise<boolean> }
    ).handleRequest({} as ThrottlerRequest)

    expect(allowed).toBe(true)
    expect(superSpy).toHaveBeenCalledTimes(1)
  })
})
