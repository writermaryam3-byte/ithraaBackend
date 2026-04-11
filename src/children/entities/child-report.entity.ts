import { TestAssignment } from 'src/tests/entities/test-assignment.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

@Entity('children-reports')
export class ChildReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TestAssignment)
  assignment: TestAssignment;

  @Column('text')
  scoreJson: string;

  @CreateDateColumn()
  createdAt: Date;
}
