import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TestAssignment } from './test-assignment.entity';

@Entity('tests')
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => TestAssignment, (a) => a.test)
  assignments: TestAssignment[];
}
