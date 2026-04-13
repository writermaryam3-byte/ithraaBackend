import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { MailerService } from 'src/mailer/mailer.service';
import { AuthProvider } from 'src/users/services/auth.provider';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resend = new Resend(process.env.RESEND_API_KEY);

  constructor(
    private readonly mailer: MailerService,
    private readonly authService: AuthProvider,
  ) {}

  async mail(to: string, subject: string, html: string) {
    try {
      const response = await this.resend.emails.send({
        from: 'onboarding@resend.dev', // أو domain بتاعك
        to,
        subject,
        html,
      });

      return response;
    } catch (error) {
      console.error('Email error:', error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, message: string): Promise<void> {
    const html = `<p style="margin:0;font-family:system-ui,sans-serif;line-height:1.5">${escapeHtml(
      message,
    ).replace(/\n/g, '<br/>')}</p>`;
    try {
      await this.mail(to, subject, html);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async sendVerificationEmail(email: string, userId: string) {
    const token = this.authService.generateVerificationToken(userId);

    const link = `http://localhost:3000/verify-email?token=${token}`;

    return this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Verify your email',
      html: `
        <h2>Verify your email</h2>
        <a href="${link}">Click here to verify</a>
      `,
    });
  }
}
