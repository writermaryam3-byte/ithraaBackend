import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentWebhookDedup } from './entities/payment-webhook-dedup.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentProcessingProcessor } from './processors/payment-processing.processor';
import { MoyasarProvider } from './providers/moyasar.provider';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { PaymentsCronService } from './payments.cron';
import { EvaluationsModule } from 'src/evaluations/evaluations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentWebhookDedup]),
    BullModule.registerQueue({
      name: 'payment-processing',
    }),
    forwardRef(() => EvaluationsModule),
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
