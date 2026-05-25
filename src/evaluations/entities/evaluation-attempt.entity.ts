import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';
import { User } from 'src/users/entities/user.entity';
import { Child } from 'src/children/entities/child.entity';
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum';
import { EvaluationAnswer } from './evaluation-answer.entity';
import { EvaluationApproval } from './evaluation-approval.entity';
import { EvaluationSlot } from './evaluation-slot.entity';

@Entity('evaluation_attempts')
@Unique('uq_eval_attempt_number', [
  'evaluationId',
  'parentId',
  'childId',
  'attemptNumber',
])
@Index('idx_eval_attempt_lookup', ['evaluationId', 'parentId', 'childId'])
@Index('uq_eval_attempt_in_progress', ['evaluationId', 'parentId', 'childId'], {
  unique: true,
  where: `"status" = 'in_progress'`,
})
export class EvaluationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  parentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: User;

  @Index()
  @Column({ type: 'uuid' })
  childId: string;

  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'childId' })
  child: Child;

  @Index()
  @Column({ type: 'uuid' })
  evaluationId: string;

  @ManyToOne(() => Evaluation, (e) => e.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column({ type: 'int' })
  attemptNumber: number; // 1 or 2

  @Column({ type: 'enum', enum: EvaluationAttemptStatus })
  status: EvaluationAttemptStatus;

  @Column('float', { nullable: true })
  score: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @OneToMany(() => EvaluationAnswer, (a) => a.attempt, { cascade: true })
  answers: EvaluationAnswer[];

  @OneToOne(() => EvaluationApproval, (ap) => ap.attempt, { nullable: true })
  approval: EvaluationApproval | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @OneToOne(() => EvaluationSlot, (slot) => slot.evaluationAttempt)
  slot: EvaluationSlot;
}
