import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface MemoryEntry {
  permissions: string[]
  expiresAt: number
}

interface RedisClientLike {
  connect(): Promise<void>
  quit(): Promise<void>
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: string, duration: number): Promise<unknown>
  del(...keys: string[]): Promise<number>
}

interface RedisConstructorLike {
  new (
    url: string,
    options: { maxRetriesPerRequest: number; enableReadyCheck: boolean; lazyConnect: boolean },
  ): RedisClientLike
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

@Injectable()
export class PermissionCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PermissionCacheService.name)
  private readonly ttlSeconds = 300
  private readonly memoryCache = new Map<string, MemoryEntry>()
  private redisClient: RedisClientLike | null = null

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL')
    if (!redisUrl) {
      this.logger.log('REDIS_URL not set — using in-memory permission cache fallback')
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('ioredis') as { default?: RedisConstructorLike } | RedisConstructorLike
      const RedisCtor = typeof mod === 'function' ? mod : mod.default
      if (!RedisCtor) {
        throw new Error('Invalid ioredis export')
      }
      this.redisClient = new RedisCtor(redisUrl, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      })
      await this.redisClient.connect()
      this.logger.log('Connected to Redis for PBAC permission caching')
    } catch (err: unknown) {
      this.logger.warn(
        `Redis unavailable (${getErrorMessage(err)}); falling back to in-memory cache`,
      )
      this.redisClient = null
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => undefined)
    }
  }

  private keyFor(employeeId: string): string {
    return `pbac:perms:v1:${employeeId}`
  }

  private versionedKeyFor(employeeId: string, authVersion: number): string {
    return `pbac:authz:v2:${employeeId}:v${authVersion}`
  }

  async getVersionedAuthz<T>(employeeId: string, authVersion: number): Promise<T | null> {
    const key = this.versionedKeyFor(employeeId, authVersion)
    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(key)
        return raw ? (JSON.parse(raw) as T) : null
      } catch (err: unknown) {
        this.logger.warn(`Redis GET authz failed for ${employeeId}: ${getErrorMessage(err)}`)
      }
    }

    const entry = this.memoryCache.get(key) as
      | { permissions: unknown; expiresAt: number }
      | undefined
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }
    return entry.permissions as T
  }

  async setVersionedAuthz<T>(
    employeeId: string,
    authVersion: number,
    snapshot: T,
    ttlOverrideSeconds?: number,
  ): Promise<void> {
    const key = this.versionedKeyFor(employeeId, authVersion)
    const ttl = ttlOverrideSeconds && ttlOverrideSeconds > 0 ? ttlOverrideSeconds : this.ttlSeconds

    if (this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(snapshot), 'EX', ttl)
        return
      } catch (err: unknown) {
        this.logger.warn(`Redis SET authz failed for ${employeeId}: ${getErrorMessage(err)}`)
      }
    }

    this.memoryCache.set(key, {
      permissions: snapshot as unknown as string[],
      expiresAt: Date.now() + ttl * 1000,
    })
  }

  async getPermissions(employeeId: string): Promise<string[] | null> {
    const key = this.keyFor(employeeId)

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(key)
        return raw ? (JSON.parse(raw) as string[]) : null
      } catch (err: unknown) {
        this.logger.warn(`Redis GET failed for ${employeeId}: ${getErrorMessage(err)}`)
      }
    }

    const entry = this.memoryCache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }
    return entry.permissions
  }

  async setPermissions(
    employeeId: string,
    permissions: string[],
    ttlOverrideSeconds?: number,
  ): Promise<void> {
    const key = this.keyFor(employeeId)
    const ttl = ttlOverrideSeconds && ttlOverrideSeconds > 0 ? ttlOverrideSeconds : this.ttlSeconds

    if (this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(permissions), 'EX', ttl)
        return
      } catch (err: unknown) {
        this.logger.warn(`Redis SET failed for ${employeeId}: ${getErrorMessage(err)}`)
      }
    }

    this.memoryCache.set(key, {
      permissions,
      expiresAt: Date.now() + ttl * 1000,
    })
  }

  async invalidateUser(employeeId: string): Promise<void> {
    const key = this.keyFor(employeeId)
    this.memoryCache.delete(key)
    const prefix = `pbac:authz:v2:${employeeId}:`
    const versionKeysToDelete: string[] = []
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(prefix)) {
        this.memoryCache.delete(k)
        versionKeysToDelete.push(k)
      }
    }

    if (this.redisClient) {
      try {
        await this.redisClient.del(key, ...versionKeysToDelete)
      } catch (err: unknown) {
        this.logger.warn(`Redis DEL failed for ${employeeId}: ${getErrorMessage(err)}`)
      }
    }
  }

  async invalidateUsers(employeeIds: string[]): Promise<void> {
    if (employeeIds.length === 0) return
    const keys = employeeIds.map((id) => this.keyFor(id))
    for (const key of keys) {
      this.memoryCache.delete(key)
    }

    if (this.redisClient) {
      try {
        await this.redisClient.del(...keys)
      } catch (err: unknown) {
        this.logger.warn(`Redis multi-DEL failed: ${getErrorMessage(err)}`)
      }
    }
  }
}
