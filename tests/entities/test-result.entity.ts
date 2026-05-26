import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { TestAssignment } from './test-assignment.entity';

@Entity('test_results')
export class TestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TestAssignment, { onDelete: 'CASCADE' })
  assignment: TestAssignment;

  @Column('float')
  score: number;

  @Column({ nullable: true })
  answersJson: string;

  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;
}
