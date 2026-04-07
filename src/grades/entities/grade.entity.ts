import { Class } from 'src/classes/entities/class.entity';
import { GradeName } from 'src/common/enums/grade-name.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Entity,
} from 'typeorm';

@Entity()
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: GradeName;

  @ManyToOne(() => Organization, (org) => org.grades, { onDelete: 'CASCADE' })
  organization: Organization;

  @OneToMany(() => Class, (cls) => cls.grade)
  classes: Class[];
}
