import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  constructor(private readonly jwtService: JwtService) {}
  private resend = new Resend(process.env.RESEND_API_KEY);
  generateVerificationToken(userId: string) {
    return this.jwtService.sign({ userId }, { expiresIn: '1d' });
  }
  async sendEmail(to: string, subject: string, html: string) {
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
  async sendVerificationEmail(email: string, userId: string) {
    const token = this.generateVerificationToken(userId);

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
