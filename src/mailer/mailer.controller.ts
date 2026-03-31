import { Body, Controller, Post } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('send')
  send() {
    return this.mailerService.sendEmail(
      'ziadzayd79@gmail.com',
      'Hello 👋',
      '<h1>Welcome</h1>',
    );
  }

  @Post('verfy-email')
  verfiyEmail(@Body() data: { email: string; userId: string }) {
    return this.mailerService.sendVerificationEmail(data.email, data.userId);
  }
}
