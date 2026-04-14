import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { EvaluationAttempt } from './evaluation-attempt.entity';
import { EvaluationQuestion } from './evaluation-question.entity';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Index()
  @Column({ type: 'uuid' })
  institutionId: string;

  @OneToMany(() => EvaluationAttempt, (a) => a.evaluation)
  attempts: EvaluationAttempt[];

  @OneToMany(() => EvaluationQuestion, (q) => q.evaluation, { cascade: true })
  questions: EvaluationQuestion[];
}

