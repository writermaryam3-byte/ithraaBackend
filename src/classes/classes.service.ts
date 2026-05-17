import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Class } from './entities/class.entity';
import { Repository } from 'typeorm';
import { AdminClassResponse } from './dto/admin-class-response.dto';
import { GradesService } from 'src/grades/grades.service';
import { OrgOwnerClassResponse } from './dto/orgOwner-class-response.dto';
import { ChildrenService } from 'src/children/children.service';
import { Teacher } from 'src/users/entities/teacher.entity';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { JwtRequestUser } from 'src/common/interfaces/jwt-request-user.interface';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classesRepo: Repository<Class>,
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,
    private readonly gradesService: GradesService,
    @Inject(forwardRef(() => ChildrenService))
    private readonly childrenService: ChildrenService,
    private readonly orgService: OrganizationsService,
  ) {}
  async create(createClassDto: CreateClassDto, currentUser: JwtRequestUser) {
    const { gradeId, teacherId, name } = createClassDto;
    const grade = await this.gradesService.findOne(gradeId);
    const organization = await this.orgService.findByOwner(currentUser.userId);
    const cls = this.classesRepo.create({
      name,
      grade,
      organization,
    });
    if (teacherId) {
      const teacher = await this.teacherRepo.findOne({
        where: { id: teacherId },
      });
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }
      cls.teacher = teacher;
    }
    return this.classesRepo.save(cls);
  }

  async findAll(): Promise<AdminClassResponse[]> {
    const classes = await this.classesRepo.find({
      relations: { grade: { organization: true } },
    });
    return classes.map((cls) => ({
      id: cls.id,
      gradeName: cls.grade.name,
      children: cls.children,
      name: cls.name,
      organizationName: cls.grade.organization.organizationName,
    }));
  }

  async findOne(id: string): Promise<OrgOwnerClassResponse> {
    const cls = await this.classesRepo.findOne({
      where: { id },
      relations: ['grade', 'children', 'teacher'],
    });
    if (!cls) throw new NotFoundException(`class with ID ${id} not found`);
    return {
      gradeName: cls.grade.name,
      id: cls.id,
      name: cls.name,
      children: cls.children,
    };
  }

  async findClassesByOrg(orgId: string) {
    const org = await this.orgService.findOneOrFail(orgId);
    const classes = await this.classesRepo.find({
      where: { organization: { id: org.id } },
      relations: {
        grade: { organization: true },
        children: true,
        teacher: { user: true },
      },
    });

    return {
      classes: classes.map((cls) => ({
        id: cls.id,
        gradeName: cls.grade.name,
        gradeId: cls.grade.id,
        childrenCount: cls.children.length,
        name: cls.name,
        teacherId: cls.teacher?.id,
        teacherName: cls.teacher?.user.name,
        organizationName: cls.grade.organization.organizationName,
        organizationId: cls.grade.organization.id,
        children: cls.children.length,
      })),
    };
  }
  async findOneOrFail(id: string) {
    const cls = await this.classesRepo.findOneBy({ id });
    if (!cls) throw new NotFoundException(`class with ID ${id} not found`);
    return cls;
  }

  async isOrgCls(classId: string, orgId: string): Promise<boolean> {
    return await this.classesRepo.exist({
      where: {
        id: classId,
        organization: {
          id: orgId,
        },
      },
    });
  }

  async update(id: string, updateClassDto: UpdateClassDto) {
    const cls = await this.findOneOrFail(id);
    const { gradeId, teacherId, ...rest } = updateClassDto;

    if (gradeId) {
      const grade = await this.gradesService.findOneOrFail(gradeId);
      cls.grade = grade;
    }

    Object.assign(cls, rest);

    if (teacherId) {
      const teacher = await this.teacherRepo.findOne({
        where: { id: teacherId },
      });
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }
      cls.teacher = teacher;
    }

    return await this.classesRepo.save(cls);
  }

  async remove(id: string) {
    const result = await this.classesRepo.delete({ id });

    if (result.affected === 0) {
      throw new NotFoundException('Class not found');
    }

    return { message: 'Deleted successfully' };
  }

  async asignChild(childId: string, clsId: string) {
    const child = await this.childrenService.findOneOrFail(childId);
    const cls = await this.findOneOrFail(clsId);
    child.class = cls;
    await this.childrenService.save(child);
    return { message: 'child asigned successfully' };
  }

  async getChildrenInClass(clsId: string) {
    const cls = await this.findOne(clsId);
    return cls.children;
  }
}
