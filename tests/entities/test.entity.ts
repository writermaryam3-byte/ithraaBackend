import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Question } from './question.entity';
import { TestAssignment } from './test-assignment.entity';

@Entity('tests')
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => Question, (q) => q.test, { cascade: true })
  questions: Question[];

  @OneToMany(() => TestAssignment, (a) => a.test)
  assignments: TestAssignment[];

  @Column()
  questionNo: number;
}
