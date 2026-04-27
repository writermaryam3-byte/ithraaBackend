import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { EvaluationAttempt } from './evaluation-attempt.entity';

@Entity('evaluation_answers')
@Unique('uq_attempt_question', ['attemptId', 'questionId'])
export class EvaluationAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => EvaluationAttempt, (a) => a.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt: EvaluationAttempt;

  @Column({ type: 'uuid' })
  questionId: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'boolean', nullable: true })
  isCorrect: boolean | null;
}
