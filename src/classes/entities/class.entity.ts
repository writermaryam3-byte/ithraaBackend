import { Child } from 'src/children/entities/child.entity';
import { Grade } from 'src/grades/entities/grade.entity';
import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Entity,
  OneToMany,
} from 'typeorm';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Grade, (grade) => grade.classes, { onDelete: 'CASCADE' })
  grade: Grade;

  @OneToMany(() => Child, (child) => child.class)
  children: Child[];
}
