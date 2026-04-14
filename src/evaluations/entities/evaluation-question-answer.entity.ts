import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EvaluationQuestion } from './evaluation-question.entity';

@Entity('evaluation_question_answers')
export class EvaluationQuestionAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  questionId: string;

  @ManyToOne(() => EvaluationQuestion, (q) => q.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: EvaluationQuestion;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;
}

