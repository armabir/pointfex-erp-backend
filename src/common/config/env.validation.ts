import * as Joi from 'joi'

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
  PBAC_MODE: Joi.string().valid('enforce', 'shadow', 'legacy').default('enforce'),
  REDIS_URL: Joi.string().uri().allow('').optional(),
  BLOCKED_IPS: Joi.string().allow('').optional(),
  THROTTLE_BYPASS: Joi.boolean().optional(),
  SEED_DEFAULT_PASSWORD: Joi.string().min(8).optional(),
})
