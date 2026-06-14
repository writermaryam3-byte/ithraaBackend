import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationProcessor } from './queues/notification.processor';
import { EmailProvider } from './providers/email.provider';
import { InAppProvider } from './providers/inapp.provider';
import { UsersModule } from 'src/users/users.module';
import { EvaluationNotificationsListener } from './listeners/evaluation-notifications.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessor,
    EmailProvider,
    InAppProvider,
    EvaluationNotificationsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
