import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendEmailResult {
  sent: boolean
  provider: 'smtp' | 'resend' | 'noop'
  error?: string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private smtpTransporter: nodemailer.Transporter | null = null
  private smtpConfigKey = ''

  constructor(private readonly configService: ConfigService) {}

  get frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'
    ).replace(/\/+$/, '')
  }

  get tempPasswordTtlHours(): number {
    const raw = Number(this.configService.get<string>('TEMP_PASSWORD_TTL_HOURS') || '24')
    return Number.isFinite(raw) && raw > 0 ? raw : 24
  }

  private getSmtpConfig(): {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  } | null {
    const user = this.configService.get<string>('SMTP_USER')?.trim() || ''
    const pass = this.configService.get<string>('SMTP_PASS')?.trim() || ''
    const explicitHost = this.configService.get<string>('SMTP_HOST')?.trim() || ''
    const host =
      explicitHost || (user.toLowerCase().endsWith('@gmail.com') ? 'smtp.gmail.com' : '')
    if (!host || !user || !pass) return null

    const rawPort = Number(this.configService.get<string>('SMTP_PORT') || '')
    const explicitSecure = this.configService.get<string>('SMTP_SECURE')?.trim()
    const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : explicitSecure === 'true' ? 465 : 587
    const secure = explicitSecure ? explicitSecure === 'true' : port === 465
    return { host, port, secure, user, pass }
  }

  private getSmtpTransporter(cfg: {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  }): nodemailer.Transporter {
    const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}`
    if (!this.smtpTransporter || this.smtpConfigKey !== key) {
      this.smtpTransporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
          user: cfg.user,
          pass: cfg.pass,
        },
      })
      this.smtpConfigKey = key
    }
    return this.smtpTransporter
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const isTest = this.configService.get<string>('NODE_ENV') === 'test'
    if (isTest) {
      this.logger.log(`Mail queued (noop/test mode): to=${input.to} subject="${input.subject}"`)
      return { sent: false, provider: 'noop' }
    }

    const smtp = this.getSmtpConfig()
    const configuredFrom = this.configService.get<string>('MAIL_FROM')?.trim()

    if (smtp) {
      const from =
        configuredFrom && !configuredFrom.includes('onboarding@resend.dev')
          ? configuredFrom
          : `Pointfex ERP <${smtp.user}>`
      try {
        const transporter = this.getSmtpTransporter(smtp)
        await transporter.sendMail({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        })
        this.logger.log(`SMTP email sent: to=${input.to} subject="${input.subject}"`)
        return { sent: true, provider: 'smtp' }
      } catch (error: any) {
        const msg = error?.message || 'SMTP delivery failed'
        this.logger.warn(`SMTP delivery failed for to=${input.to}: ${msg}`)
        return { sent: false, provider: 'smtp', error: msg }
      }
    }

    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim()
    const from = configuredFrom || 'Pointfex ERP <no-reply@pointfex.internal>'

    if (!apiKey) {
      this.logger.log(`Mail queued (noop/test mode): to=${input.to} subject="${input.subject}"`)
      return { sent: false, provider: 'noop' }
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        const hint =
          response.status === 403
            ? 'Resend test sender can only deliver to your own verified Resend account email until a domain is verified.'
            : `Resend rejected delivery (${response.status}).`
        this.logger.warn(
          `Resend delivery failed: status=${response.status} to=${input.to} detail=${body.slice(0, 200)}`,
        )
        return { sent: false, provider: 'resend', error: hint }
      }

      this.logger.log(`Resend email sent: to=${input.to} subject="${input.subject}"`)
      return { sent: true, provider: 'resend' }
    } catch (error: any) {
      const msg = error?.message || 'Network error while sending email'
      this.logger.warn(`Resend request error for to=${input.to}: ${msg}`)
      return { sent: false, provider: 'resend', error: msg }
    }
  }

  async sendWelcomeSetupLink(params: {
    to: string
    name: string
    setupToken: string
    ttlHours?: number
  }) {
    const ttl = params.ttlHours ?? this.tempPasswordTtlHours
    const setupUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(params.setupToken)}&onboarding=1`
    return this.sendEmail({
      to: params.to,
      subject: 'Welcome to Pointfex ERP — Activate Your Account (24h One-Time Link)',
      text: [
        `Hello ${params.name},`,
        '',
        'Your Pointfex ERP account has been provisioned.',
        `Login ID: ${params.to}`,
        `You can sign in directly with Google or use this one-time link (valid for ${ttl} hours) to set your password:`,
        setupUrl,
        '',
        'This link can only be used once. After activation, you can sign in anytime with Google or your password without extra login codes.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="margin:0 0 12px;">Welcome to Pointfex ERP</h2>
          <p>Hello ${this.escapeHtml(params.name)},</p>
          <p>Your Pointfex ERP account has been provisioned. Your login ID is <strong>${this.escapeHtml(params.to)}</strong>.</p>
          <p>You can sign in directly with Google, or click the button below to set your password and activate your account. This link is valid for <strong>${ttl} hours</strong> and can be used <strong>once</strong>:</p>
          <p><a href="${this.escapeHtml(setupUrl)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Set Password &amp; Activate Account</a></p>
          <p style="font-size:12px;color:#6B7280;">If the button does not work, copy this link: ${this.escapeHtml(setupUrl)}</p>
        </div>
      `,
    })
  }

  async sendWelcomeTempPassword(params: {
    to: string
    name: string
    temporaryPassword: string
    ttlHours?: number
  }) {
    const ttl = params.ttlHours ?? this.tempPasswordTtlHours
    const loginUrl = `${this.frontendUrl}/login`
    return this.sendEmail({
      to: params.to,
      subject: 'Welcome to Pointfex ERP — Temporary Sign-In Credentials',
      text: [
        `Hello ${params.name},`,
        '',
        'Your Pointfex ERP account has been provisioned.',
        `Login email (your ID): ${params.to}`,
        `Temporary password: ${params.temporaryPassword}`,
        `Sign in at: ${loginUrl}`,
        `This temporary password expires in ${ttl} hours. You will be required to set a new password on first login.`,
        'Never share this password with anyone, including administrators.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="margin:0 0 12px;">Welcome to Pointfex ERP</h2>
          <p>Hello ${this.escapeHtml(params.name)},</p>
          <p>Your Pointfex ERP account has been provisioned. Your login ID is <strong>${this.escapeHtml(params.to)}</strong>.</p>
          <div style="background:#F7F8FA;border:1px solid #E5E7EB;border-radius:8px;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:15px;">
            ${this.escapeHtml(params.temporaryPassword)}
          </div>
          <p><strong>Expires in:</strong> ${ttl} hours</p>
          <p style="font-size:12px;color:#DC2626;">Never share this password with anyone, including administrators.</p>
          <p><a href="${this.escapeHtml(loginUrl)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Sign in to Pointfex ERP</a></p>
        </div>
      `,
    })
  }

  async sendAdminResetLink(params: {
    to: string
    name: string
    resetToken: string
    ttlHours?: number
  }) {
    const ttl = params.ttlHours ?? this.tempPasswordTtlHours
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(params.resetToken)}&onboarding=1`
    return this.sendEmail({
      to: params.to,
      subject: 'Pointfex ERP — Your Password Was Reset by an Administrator',
      text: [
        `Hello ${params.name},`,
        '',
        'An administrator has reset your Pointfex ERP password and revoked active sessions.',
        `Click this one-time link (valid for ${ttl} hours) to set your new password:`,
        resetUrl,
        '',
        'This link can only be used once. After setting your password, you can sign in directly with Google or your new credentials.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="margin:0 0 12px;">Administrator Password Reset</h2>
          <p>Hello ${this.escapeHtml(params.name)},</p>
          <p>An administrator reset your Pointfex ERP password and revoked active sessions.</p>
          <p>Click the button below to choose your new password. This link is valid for <strong>${ttl} hours</strong> and can be used <strong>once</strong>:</p>
          <p><a href="${this.escapeHtml(resetUrl)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Set New Password</a></p>
          <p style="font-size:12px;color:#6B7280;">If you did not request this, contact your administrator immediately.</p>
        </div>
      `,
    })
  }

  async sendAdminResetTempPassword(params: {
    to: string
    name: string
    temporaryPassword?: string
    resetToken?: string
    ttlHours?: number
  }) {
    return this.sendAdminResetLink({
      to: params.to,
      name: params.name,
      resetToken: params.resetToken || params.temporaryPassword || '',
      ttlHours: params.ttlHours,
    })
  }

  async sendPasswordResetLink(params: {
    to: string
    name: string
    resetToken: string
    ttlMinutes?: number
  }) {
    const ttlMinutes = params.ttlMinutes ?? 30
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(params.resetToken)}`
    return this.sendEmail({
      to: params.to,
      subject: 'Pointfex ERP — Password Reset Request',
      text: [
        `Hello ${params.name},`,
        '',
        'A password reset was requested for your Pointfex ERP account.',
        `Reset link (expires in ${ttlMinutes} minutes): ${resetUrl}`,
        'If you did not request this, you can safely ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="margin:0 0 12px;">Password Reset Request</h2>
          <p>Hello ${this.escapeHtml(params.name)},</p>
          <p>Click the button below to reset your Pointfex ERP password. This link expires in ${ttlMinutes} minutes.</p>
          <p><a href="${this.escapeHtml(resetUrl)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Reset Password</a></p>
          <p style="font-size:12px;color:#6B7280;">If you did not request this, ignore this email.</p>
        </div>
      `,
    })
  }

  async sendMfaResetNotice(params: { to: string; name: string }) {
    const loginUrl = `${this.frontendUrl}/login`
    return this.sendEmail({
      to: params.to,
      subject: 'Pointfex ERP — Your MFA Was Reset by an Administrator',
      text: [
        `Hello ${params.name},`,
        '',
        'Your MFA was reset by an administrator; sign in and set it up again.',
        `Sign in at: ${loginUrl}`,
      ].join('\n'),
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="margin:0 0 12px;">MFA Reset Notification</h2>
          <p>Hello ${this.escapeHtml(params.name)},</p>
          <p>Your MFA was reset by an administrator; sign in and set it up again.</p>
          <p><a href="${this.escapeHtml(loginUrl)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Sign in to Pointfex ERP</a></p>
        </div>
      `,
    })
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

