import { Grade } from 'src/grades/entities/grade.entity';
import { PrimaryGeneratedColumn, Column, ManyToOne, Entity } from 'typeorm';

@Entity()
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Grade, (grade) => grade.classes, { onDelete: 'CASCADE' })
  grade: Grade;
}
