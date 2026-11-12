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
})

