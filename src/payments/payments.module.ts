import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentWebhookDedup } from './entities/payment-webhook-dedup.entity';
import { Child } from 'src/children/entities/child.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentProcessingProcessor } from './processors/payment-processing.processor';
import { MoyasarProvider } from './providers/moyasar.provider';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { PaymentsCronService } from './payments.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentWebhookDedup, Child]),
    BullModule.registerQueue({
      name: 'payment-processing',
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProcessingProcessor,
    PaymentsCronService,
    MoyasarProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: MoyasarProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
