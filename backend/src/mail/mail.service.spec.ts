import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { MailService } from './mail.service'

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}))

describe('MailService', () => {
  const createConfig = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses Gmail SMTP when SMTP_USER and SMTP_PASS are configured and overrides onboarding@resend.dev', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' })
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail })

    const mail = new MailService(
      createConfig({
        NODE_ENV: 'production',
        SMTP_USER: 'contact.pointfex@gmail.com',
        SMTP_PASS: 'app-password-placeholder',
        MAIL_FROM: 'Pointfex ERP <onboarding@resend.dev>',
      }),
    )

    const result = await mail.sendEmail({
      to: 'employee@example.com',
      subject: 'Test',
      text: 'Hello',
      html: '<p>Hello</p>',
    })

    expect(result).toEqual({ sent: true, provider: 'smtp' })
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'contact.pointfex@gmail.com',
        pass: 'app-password-placeholder',
      },
    })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Pointfex ERP <contact.pointfex@gmail.com>',
      to: 'employee@example.com',
      subject: 'Test',
      text: 'Hello',
      html: '<p>Hello</p>',
    })
  })

  it('returns noop in test mode without sending via SMTP or Resend', async () => {
    const mail = new MailService(
      createConfig({
        NODE_ENV: 'test',
        SMTP_USER: 'contact.pointfex@gmail.com',
        SMTP_PASS: 'app-password-placeholder',
      }),
    )

    const result = await mail.sendEmail({
      to: 'employee@example.com',
      subject: 'Test',
      text: 'Hello',
      html: '<p>Hello</p>',
    })

    expect(result).toEqual({ sent: false, provider: 'noop' })
    expect(nodemailer.createTransport).not.toHaveBeenCalled()
  })

  it('sendAdminResetLink formats one-time setup URL and sends link without temporary password', async () => {
    const mail = new MailService(
      createConfig({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://pointfex.app',
      }),
    )
    const spy = jest.spyOn(mail, 'sendEmail').mockResolvedValue({ sent: true, provider: 'noop' })

    await mail.sendAdminResetLink({
      to: 'user@example.com',
      name: 'User',
      resetToken: 'token_abc123',
      ttlHours: 48,
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const callArg = spy.mock.calls[0][0]
    expect(callArg.to).toBe('user@example.com')
    expect(callArg.subject).toContain('Password Was Reset')
    expect(callArg.text).toContain('https://pointfex.app/reset-password?token=token_abc123&onboarding=1')
    expect(callArg.html).toContain('https://pointfex.app/reset-password?token=token_abc123&amp;onboarding=1')
    expect(callArg.text).not.toContain('Temporary password:')
  })
})

