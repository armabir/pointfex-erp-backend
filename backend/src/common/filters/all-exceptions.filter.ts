import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Request, Response } from 'express'
import { extractClientIp } from '../ip-address.util'

/**
 * Global exception boundary preventing any raw stack traces, SQL errors,
 * or Prisma internals from leaking to clients while writing structured JSON logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const clientIp = extractClientIp(request)
    const timestamp = new Date().toISOString()

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error. Please try again later.'

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const exceptionBody = exception.getResponse()
      if (typeof exceptionBody === 'string') {
        message = exceptionBody
      } else if (exceptionBody && typeof exceptionBody === 'object' && 'message' in exceptionBody) {
        message = (exceptionBody as { message: string | string[] }).message
      } else {
        message = exception.message
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          statusCode = HttpStatus.CONFLICT
          message = 'A record with the provided unique identifier already exists.'
          break
        case 'P2003':
          statusCode = HttpStatus.BAD_REQUEST
          message = 'The referenced related resource does not exist.'
          break
        case 'P2025':
          statusCode = HttpStatus.NOT_FOUND
          message = 'Requested resource was not found.'
          break
        default:
          statusCode = HttpStatus.BAD_REQUEST
          message = 'Unable to complete the requested database operation.'
          break
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST
      message = 'Invalid request payload or query parameters.'
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE
      message = 'Service temporarily unavailable.'
    }

    const logPayload = {
      timestamp,
      method: request.method,
      path: request.url,
      ip: clientIp,
      statusCode,
      error: exception instanceof Error ? exception.name : 'UnknownError',
      detail: exception instanceof Error ? exception.message : String(exception),
    }

    if (statusCode >= 500) {
      this.logger.error(
        JSON.stringify(logPayload),
        exception instanceof Error ? exception.stack : undefined,
      )
    } else {
      this.logger.warn(JSON.stringify(logPayload))
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp,
      path: request.url,
    })
  }
}
