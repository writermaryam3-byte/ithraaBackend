import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { Test } from './test.entity';
import { Child } from 'src/children/entities/child.entity';

@Entity('test_assignments')
export class TestAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  child: Child;

  @ManyToOne(() => Test, (test) => test.assignments, { onDelete: 'CASCADE' })
  test: Test;

  @Column({ type: 'date' })
  due_date: Date;

  @Column({ default: 'pending' })
  status: string;
}
