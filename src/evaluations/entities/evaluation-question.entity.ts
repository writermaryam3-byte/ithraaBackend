import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';
import { EvaluationQuestionAnswer } from './evaluation-question-answer.entity';

@Entity('evaluation_questions')
export class EvaluationQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  evaluationId: string;

  @ManyToOne(() => Evaluation, (e) => e.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', default: 1 })
  order: number;

  @OneToMany(() => EvaluationQuestionAnswer, (a) => a.question, {
    cascade: true,
  })
  answers: EvaluationQuestionAnswer[];
}

