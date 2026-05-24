import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Test } from './test.entity';
import { Answer } from './answer.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @ManyToOne(() => Test, (test) => test.questions, {
    onDelete: 'CASCADE',
  })
  test: Test;

  @OneToMany(() => Answer, (answer) => answer.question, {
    cascade: true,
  })
  answers: Answer[];
}
