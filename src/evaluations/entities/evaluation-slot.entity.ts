import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { SlotStatus } from '../enums/evaluation-slot-status.enum';
import { Child } from 'src/children/entities/child.entity';
import { SlotKind } from '../enums/evaluation-slot-kind.enum';
import { EvaluationAttempt } from './evaluation-attempt.entity';

@Entity('evaluation_slot')
@Index('idx_evaluation_slot_child_status', ['childId', 'status'])
@Index('uq_evaluation_slot_active_kind', ['childId', 'parentId', 'kind'], {
  unique: true,
  where: `"status" IN ('READY', 'REQUESTED', 'AWAITING_PAYMENT', 'CONSUMED')`,
})
@Index('uq_evaluation_slot_attempt', ['evaluationAttemptId'], {
  unique: true,
  where: `"evaluationAttemptId" IS NOT NULL`,
})
export class EvaluationSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  childId: string;

  @ManyToOne(() => Child, (c) => c.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'childId' })
  child: Child;

  @Index()
  @Column({ type: 'uuid' })
  parentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: User;

  @Column({ type: 'enum', enum: SlotKind })
  kind: SlotKind;

  @Column({ type: 'enum', enum: SlotStatus })
  status: SlotStatus;

  // deprecated

  @Column({ default: false })
  isPaid: boolean;

  @Column({ default: false })
  requiresApproval: boolean;

  @Column({ type: 'uuid', nullable: true })
  evaluationAttemptId: string | null;

  @OneToOne(() => EvaluationAttempt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'evaluationAttemptId' })
  evaluationAttempt: EvaluationAttempt | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  transitionTo(next: SlotStatus) {
    const validTransitions: Record<SlotStatus, SlotStatus[]> = {
      [SlotStatus.READY]: [SlotStatus.CONSUMED],

      [SlotStatus.REQUESTED]: [SlotStatus.AWAITING_PAYMENT, SlotStatus.READY],
      [SlotStatus.AWAITING_PAYMENT]: [SlotStatus.READY],
      [SlotStatus.CONSUMED]: [SlotStatus.COMPLETED],
      [SlotStatus.COMPLETED]: [],
    };

    const allowed = validTransitions[this.status] || [];

    if (!allowed.includes(next)) {
      throw new Error(`Invalid transition from ${this.status} to ${next}`);
    }

    this.status = next;
  }
}
