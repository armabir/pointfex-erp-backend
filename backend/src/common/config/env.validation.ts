import * as Joi from 'joi'

function extractPgHostname(uri?: string): string {
  if (!uri) return ''
  try {
    const parsed = new URL(uri)
    return parsed.hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function isLocalDatabaseHost(hostname: string): boolean {
  const norm = hostname.trim().toLowerCase()
  return norm === 'localhost' || norm === '127.0.0.1' || norm === '::1' || norm === 'postgres'
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().required(),
  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required()
    .messages({
      'string.pattern.base': 'DATABASE_URL must be a valid PostgreSQL connection URI.',
      'any.required': 'DATABASE_URL is required.',
    }),
  DIRECT_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .allow('')
    .optional(),
  SEED_PROFILE: Joi.string().valid('production', 'demo').optional(),
  ALLOW_DEMO_SEED: Joi.string().valid('true', 'false').optional(),
  CEO_EMAIL: Joi.string().email().allow('').optional(),
  CEO_INITIAL_PASSWORD: Joi.string().min(12).allow('').optional(),
  CEO_EMPLOYEE_ID: Joi.string().allow('').optional(),
  AWS_ENDPOINT_URL_S3: Joi.string().uri().allow('').optional(),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_REGION: Joi.string().allow('').optional(),
  S3_BUCKET: Joi.string().allow('').optional(),
  CORS_ORIGIN: Joi.string().min(1).required(),
  JWT_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_SECRET must be at least 16 characters long.',
    'any.required': 'JWT_SECRET is required.',
  }),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: Joi.number().integer().min(1).max(90).default(7),
  COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),
  AUTHZ_MODE: Joi.string().valid('enforce', 'shadow', 'legacy').default('shadow'),
  PBAC_MODE: Joi.string().valid('enforce', 'shadow', 'legacy').default('shadow'),
  REDIS_URL: Joi.string().uri().allow('').optional(),
  BLOCKED_IPS: Joi.string().allow('').optional(),
  THROTTLE_BYPASS: Joi.boolean().optional(),
  SEED_DEFAULT_PASSWORD: Joi.string().min(8).optional(),
  RESEND_API_KEY: Joi.string().allow('').optional(),
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().integer().min(1).max(65535).optional(),
  SMTP_SECURE: Joi.string().valid('true', 'false').optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').optional(),
  FRONTEND_URL: Joi.string().uri().allow('').optional(),
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_REDIRECT_URI: Joi.string().uri().allow('').optional(),
  LOGIN_ALLOWLIST_REQUIRED: Joi.string().valid('true', 'false').default('false'),
  ALLOW_DOMAIN_RULES: Joi.string().valid('true', 'false').default('false'),
  TEMP_PASSWORD_TTL_HOURS: Joi.number().integer().min(1).max(168).default(24),
}).custom((env, helpers) => {
  const dbHost = extractPgHostname(env.DATABASE_URL)
  const isRemoteDb = Boolean(dbHost) && !isLocalDatabaseHost(dbHost)
  const isNeon = dbHost.includes('neon.tech') || isRemoteDb

  if (isNeon && (!env.DIRECT_URL || String(env.DIRECT_URL).trim() === '')) {
    return helpers.message({
      custom:
        'DIRECT_URL is required when connecting to Neon or any remote PostgreSQL database.',
    })
  }

  if (dbHost.includes('neon.tech')) {
    try {
      const url = new URL(env.DATABASE_URL)
      if (
        url.searchParams.get('sslmode') !== 'require' ||
        url.searchParams.get('pgbouncer') !== 'true' ||
        url.searchParams.get('connect_timeout') !== '15'
      ) {
        return helpers.message({
          custom:
            'Pooled Neon DATABASE_URL must include ?sslmode=require&pgbouncer=true&connect_timeout=15.',
        })
      }
    } catch {
      return helpers.message({ custom: 'DATABASE_URL must be a valid URL.' })
    }
  }

  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET || String(env.JWT_SECRET).length < 32) {
      return helpers.message({
        custom: 'Production requires JWT_SECRET to be at least 32 characters long.',
      })
    }
    if (/REPLACE_WITH|change_me|default/i.test(String(env.JWT_SECRET))) {
      return helpers.message({
        custom: 'Production JWT_SECRET must not use a placeholder or default value.',
      })
    }
  }

  return env
})
