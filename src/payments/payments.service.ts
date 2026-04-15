import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { JobOptions, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { Child } from 'src/children/entities/child.entity';
import { Payment, type PaymentMetadata } from './entities/payment.entity';
import { PaymentWebhookDedup } from './entities/payment-webhook-dedup.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatusEnum } from './enums/payment-status.enum';
import { PaymentProviderEnum } from './enums/payment-provider.enum';
import { PaymentJobName } from './enums/payment-job-name.enum';
import type { PaymentProvider } from './interfaces/payment-provider.interface';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import type {
  ProcessPaymentWebhookJobPayload,
  HandlePaymentFailureJobPayload,
  HandlePaymentSuccessJobPayload,
} from './interfaces/payment-job-payload.interface';
import {
  PAYMENT_EVENTS,
  type PaymentFailedEventPayload,
  type PaymentSuccessEventPayload,
} from './payments.events';

const PAYMENT_QUEUE_JOB_OPTIONS: JobOptions = {
  attempts: Number(process.env.PAYMENT_JOB_ATTEMPTS ?? 8),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.PAYMENT_JOB_BACKOFF_MS ?? 2000),
  },
  removeOnComplete: Number(process.env.PAYMENT_JOB_REMOVE_ON_COMPLETE ?? 200),
  removeOnFail: Number(process.env.PAYMENT_JOB_REMOVE_ON_FAIL ?? 100),
};

function isPgUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code = (err as QueryFailedError & { driverError?: { code?: string } })
    .driverError?.code;
  return code === '23505';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProvider,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    @InjectQueue('payment-processing')
    private readonly paymentQueue: Queue,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentWebhookDedup)
    private readonly webhookDedup: Repository<PaymentWebhookDedup>,
    @InjectRepository(Child)
    private readonly children: Repository<Child>,
  ) {}

  private resolveProvider(
    requested?: PaymentProviderEnum,
  ): PaymentProviderEnum {
    const fallback =
      (this.config.get<string>('DEFAULT_PAYMENT_PROVIDER') as
        | PaymentProviderEnum
        | undefined) ?? PaymentProviderEnum.MOYASAR;
    const code = requested ?? fallback;
    if (code !== this.provider.providerCode) {
      throw new BadRequestException(
        `Payment provider "${code}" is not active yet. Active provider: ${this.provider.providerCode}`,
      );
    }
    return code;
  }

  private defaultExpiresAt(): Date {
    const minutes = Number(
      this.config.get<string>('PAYMENT_EXPIRY_MINUTES') ?? 60 * 24,
    );
    return new Date(Date.now() + minutes * 60_000);
  }

  private maxRetriesDefault(): number {
    return Number(this.config.get<string>('PAYMENT_MAX_RETRIES') ?? 3);
  }

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<{
    id: string;
    checkoutUrl: string;
    expiresAt: Date;
    status: PaymentStatusEnum;
  }> {
    const currency = (dto.currency ?? 'SAR').toUpperCase();
    if (currency !== 'SAR') {
      throw new BadRequestException('Only SAR currency is supported');
    }

    const providerCode = this.resolveProvider(dto.provider);

    const child = await this.children.findOne({
      where: { id: dto.childId, parent: { id: userId } },
    });
    if (!child) {
      throw new ForbiddenException('Child not found for this parent');
    }

    const metadata: PaymentMetadata = {
      childId: dto.childId,
      ...(dto.attemptRequestId
        ? { attemptRequestId: dto.attemptRequestId }
        : {}),
      ...(dto.description ? { description: dto.description } : {}),
    };

    const amountStr = dto.amount.toFixed(2);
    const publicUrl =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ??
      'http://localhost:3000';

    const payment = this.payments.create({
      userId,
      amount: amountStr,
      currency,
      status: PaymentStatusEnum.PENDING,
      provider: providerCode,
      providerPaymentId: null,
      metadata,
      retryCount: 0,
      maxRetries: this.maxRetriesDefault(),
      expiresAt: this.defaultExpiresAt(),
    });

    const saved = await this.payments.save(payment);

    try {
      const session = await this.provider.createPayment({
        amount: dto.amount,
        currency: 'SAR',
        clientReferenceId: saved.id,
        description: dto.description,
        successUrl: `${publicUrl}/payments/complete?ref=${encodeURIComponent(saved.id)}`,
        cancelUrl: `${publicUrl}/payments/cancel?ref=${encodeURIComponent(saved.id)}`,
        metadata: metadata as Record<string, unknown>,
      });

      saved.providerPaymentId = session.providerId;
      await this.payments.save(saved);

      this.logger.log(
        `Created payment ${saved.id} (${providerCode}) session ${session.providerId}`,
      );

      return {
        id: saved.id,
        checkoutUrl: session.url,
        expiresAt: saved.expiresAt,
        status: saved.status,
      };
    } catch (err) {
      this.logger.error(
        `Provider session failed for payment ${saved.id}`,
        err instanceof Error ? err.stack : undefined,
      );
      saved.status = PaymentStatusEnum.FAILED;
      await this.payments.save(saved);
      throw err;
    }
  }

  /**
   * Validates signature, deduplicates, enqueues async processing.
   */
  async handleWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ accepted: boolean; deduplicated?: boolean }> {
    try {
      this.provider.verifyWebhookSignature(rawBody, signatureHeader);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid webhook');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON webhook body');
    }

    const providerPaymentId = this.provider.extractProviderPaymentId(parsed);
    if (!providerPaymentId) {
      throw new BadRequestException(
        'Webhook payload missing payment identifier',
      );
    }

    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    try {
      await this.webhookDedup.save(
        this.webhookDedup.create({ providerPaymentId, payloadHash }),
      );
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        this.logger.log(
          `Duplicate webhook ignored for provider payment ${providerPaymentId}`,
        );
        return { accepted: true, deduplicated: true };
      }
      throw err;
    }

    const jobPayload: ProcessPaymentWebhookJobPayload = {
      providerPaymentId,
      rawBody: rawBody.toString('utf8'),
    };

    await this.paymentQueue.add(
      PaymentJobName.PROCESS_PAYMENT_WEBHOOK,
      jobPayload,
      PAYMENT_QUEUE_JOB_OPTIONS,
    );

    this.logger.log(
      `Queued ${PaymentJobName.PROCESS_PAYMENT_WEBHOOK} for ${providerPaymentId}`,
    );

    return { accepted: true };
  }

  /**
   * Worker entry: verify with provider, persist terminal status in a transaction, chain side-effect jobs.
   */
  async runProcessPaymentWebhookJob(
    payload: ProcessPaymentWebhookJobPayload,
  ): Promise<void> {
    const payment = await this.payments.findOne({
      where: { providerPaymentId: payload.providerPaymentId },
    });

    if (!payment) {
      this.logger.warn(
        `No local payment for provider id ${payload.providerPaymentId}`,
      );
      return;
    }

    if (
      payment.status === PaymentStatusEnum.PAID ||
      payment.status === PaymentStatusEnum.FAILED ||
      payment.status === PaymentStatusEnum.EXPIRED
    ) {
      this.logger.log(
        `Payment ${payment.id} already terminal (${payment.status}), skipping webhook worker`,
      );
      return;
    }

    const { status } = await this.provider.verifyPayment(
      payload.providerPaymentId,
    );

    if (status === 'pending') {
      this.logger.log(
        `Provider reports pending for ${payment.id} — waiting for a later webhook`,
      );
      return;
    }

    const nextStatus =
      status === 'paid' ? PaymentStatusEnum.PAID : PaymentStatusEnum.FAILED;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Payment);
      const row = await repo.findOne({
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!row) return;
      if (row.status !== PaymentStatusEnum.PENDING) {
        return;
      }

      row.status = nextStatus;
      await repo.save(row);
    });

    const fresh = await this.payments.findOne({ where: { id: payment.id } });
    if (!fresh || fresh.status !== nextStatus) {
      return;
    }

    if (nextStatus === PaymentStatusEnum.PAID) {
      await this.enqueuePaymentSuccess(fresh.id);
    } else {
      await this.enqueuePaymentFailure(
        fresh.id,
        'provider_verification_failed',
      );
    }
  }

  private async enqueuePaymentSuccess(paymentId: string): Promise<void> {
    const payload: HandlePaymentSuccessJobPayload = { paymentId };
    await this.paymentQueue.add(
      PaymentJobName.HANDLE_PAYMENT_SUCCESS,
      payload,
      PAYMENT_QUEUE_JOB_OPTIONS,
    );
  }

  private async enqueuePaymentFailure(
    paymentId: string,
    reason?: string,
  ): Promise<void> {
    const payload: HandlePaymentFailureJobPayload = { paymentId, reason };
    await this.paymentQueue.add(
      PaymentJobName.HANDLE_PAYMENT_FAILURE,
      payload,
      PAYMENT_QUEUE_JOB_OPTIONS,
    );
  }

  async runHandlePaymentSuccessJob(
    payload: HandlePaymentSuccessJobPayload,
  ): Promise<void> {
    const payment = await this.payments.findOne({
      where: { id: payload.paymentId },
    });
    if (!payment || payment.status !== PaymentStatusEnum.PAID) {
      return;
    }

    const eventPayload: PaymentSuccessEventPayload = {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
    };

    this.logger.log(`Emitting ${PAYMENT_EVENTS.SUCCESS} for ${payment.id}`);
    this.events.emit(PAYMENT_EVENTS.SUCCESS, eventPayload);
  }

  async runHandlePaymentFailureJob(
    payload: HandlePaymentFailureJobPayload,
  ): Promise<void> {
    const payment = await this.payments.findOne({
      where: { id: payload.paymentId },
    });
    if (!payment) {
      return;
    }

    const eventPayload: PaymentFailedEventPayload = {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
      reason: payload.reason,
    };

    this.logger.log(`Emitting ${PAYMENT_EVENTS.FAILED} for ${payment.id}`);
    this.events.emit(PAYMENT_EVENTS.FAILED, eventPayload);
  }

  async retryPayment(
    paymentId: string,
    userId: string,
  ): Promise<{
    id: string;
    checkoutUrl: string;
    expiresAt: Date;
    status: PaymentStatusEnum;
  }> {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException('Payment does not belong to this user');
    }
    if (
      payment.status !== PaymentStatusEnum.FAILED &&
      payment.status !== PaymentStatusEnum.EXPIRED
    ) {
      throw new BadRequestException(
        'Only failed or expired payments can be retried',
      );
    }
    if (payment.retryCount >= payment.maxRetries) {
      throw new BadRequestException('Maximum retries exceeded');
    }

    return this.executePaymentRetry(payment);
  }

  /**
   * Marks stale pending payments as expired. Returns number of rows updated.
   */
  async expirePayments(): Promise<number> {
    const res = await this.payments
      .createQueryBuilder()
      .update(Payment)
      .set({ status: PaymentStatusEnum.EXPIRED })
      .where('status = :pending', { pending: PaymentStatusEnum.PENDING })
      .andWhere('"expiresAt" < :now', { now: new Date() })
      .execute();

    const affected = res.affected ?? 0;
    if (affected > 0) {
      this.logger.log(`Expired ${affected} pending payment(s)`);
    }
    return affected;
  }

  /**
   * Optional batch auto-retry for failed payments (cooldown + cap).
   */
  async autoRetryFailedPayments(): Promise<void> {
    const cooldownMs = Number(
      process.env.PAYMENT_AUTO_RETRY_COOLDOWN_MS ?? 600_000,
    );
    const staleBefore = new Date(Date.now() - cooldownMs);
    const batchSize = Number(process.env.PAYMENT_AUTO_RETRY_BATCH ?? 20);

    const candidates = await this.payments
      .createQueryBuilder('p')
      .where('p.status = :failed', { failed: PaymentStatusEnum.FAILED })
      .andWhere('p."retryCount" < p."maxRetries"')
      .andWhere('p."updatedAt" < :stale', { stale: staleBefore })
      .orderBy('p."updatedAt"', 'ASC')
      .take(batchSize)
      .getMany();

    for (const p of candidates) {
      try {
        await this.executePaymentRetry(p);
        this.logger.log(`Auto-retry scheduled new session for payment ${p.id}`);
      } catch (err) {
        this.logger.warn(
          `Auto-retry failed for payment ${p.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async executePaymentRetry(payment: Payment): Promise<{
    id: string;
    checkoutUrl: string;
    expiresAt: Date;
    status: PaymentStatusEnum;
  }> {
    const publicUrl =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ??
      'http://localhost:3000';

    payment.retryCount += 1;
    payment.status = PaymentStatusEnum.PENDING;
    payment.expiresAt = this.defaultExpiresAt();
    payment.providerPaymentId = null;
    await this.payments.save(payment);

    const amountNum = Number(payment.amount);

    try {
      const session = await this.provider.createPayment({
        amount: amountNum,
        currency: 'SAR',
        clientReferenceId: payment.id,
        description:
          typeof payment.metadata.description === 'string'
            ? payment.metadata.description
            : undefined,
        successUrl: `${publicUrl}/payments/complete?ref=${encodeURIComponent(payment.id)}`,
        cancelUrl: `${publicUrl}/payments/cancel?ref=${encodeURIComponent(payment.id)}`,
        metadata: payment.metadata as Record<string, unknown>,
      });

      payment.providerPaymentId = session.providerId;
      await this.payments.save(payment);

      return {
        id: payment.id,
        checkoutUrl: session.url,
        expiresAt: payment.expiresAt,
        status: payment.status,
      };
    } catch (err) {
      this.logger.error(
        `Retry provider session failed for ${payment.id}`,
        err instanceof Error ? err.stack : undefined,
      );
      payment.status = PaymentStatusEnum.FAILED;
      await this.payments.save(payment);
      throw err;
    }
  }
}
