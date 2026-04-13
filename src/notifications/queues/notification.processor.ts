import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EmailProvider } from '../providers/email.provider';
import { InAppProvider } from '../providers/inapp.provider';
import { NotificationDelivery } from '../enums/notification-delivery.enum';
import type { NotificationSendJobPayload } from '../interfaces/notification-job.interface';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly email: EmailProvider,
    private readonly inApp: InAppProvider,
  ) {}

  @OnQueueFailed({ name: 'send' })
  onFailed(job: Job<NotificationSendJobPayload>, err: Error) {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`,
      err.stack,
    );
  }

  @Process({
    name: 'send',
    concurrency: Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY ?? 5),
  })
  async handleSend(job: Job<NotificationSendJobPayload>): Promise<void> {
    const { delivery, userId, email, title, message } = job.data;

    if (!title?.trim() || !message?.trim()) {
      this.logger.warn(`Job ${job.id}: missing title or message, skipping`);
      return;
    }

    const sendEmail =
      delivery === NotificationDelivery.EMAIL ||
      delivery === NotificationDelivery.BOTH;

    const sendVerificationEmail = delivery === NotificationDelivery.VERIFYEMAIL;
    const sendInApp =
      delivery === NotificationDelivery.IN_APP ||
      delivery === NotificationDelivery.BOTH;

    if (sendEmail) {
      if (!email?.trim()) {
        throw new Error(
          `Job ${job.id}: email delivery requested but no email address provided`,
        );
      }
      await this.email.sendEmail(email, title, message);
    }
    if (sendVerificationEmail) {
      if (!email?.trim()) {
        throw new Error(
          `Job ${job.id}: email delivery requested but no email address provided`,
        );
      }
      await this.email.sendVerificationEmail(email, userId);
    }

    if (sendInApp) {
      await this.inApp.create(userId, title, message);
    }
  }
}
