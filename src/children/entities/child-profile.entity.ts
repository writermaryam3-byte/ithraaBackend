import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Child } from './child.entity';

@Entity('children_profiles')
export class ChildProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Child, (child) => child.profile)
  @JoinColumn()
  child: Child;

  @Column({ nullable: true })
  diagnoses: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: 'active' })
  status: string;
}
