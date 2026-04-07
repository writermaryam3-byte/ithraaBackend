import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Class } from './entities/class.entity';
import { Repository } from 'typeorm';
import { AdminClassResponse } from './dto/admin-class-response.dto';
import { GradesService } from 'src/grades/grades.service';
import { OrgOwnerClassResponse } from './dto/orgOwner-class-response.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classesRepo: Repository<Class>,
    private readonly gradesService: GradesService,
  ) {}
  async create(createClassDto: CreateClassDto) {
    const grade = await this.gradesService.findOne(createClassDto.gradeId);
    const cls = await this.classesRepo.save({
      ...createClassDto,
      grade,
    });
    return cls;
  }

  async findAll(): Promise<AdminClassResponse[]> {
    const classes = await this.classesRepo.find({
      relations: { grade: { organization: true } },
    });
    console.log(classes);
    return classes.map((cls) => ({
      id: cls.id,
      gradeName: cls.grade.name,
      name: cls.name,
      organizationName: cls.grade.organization.organization_name,
    }));
  }

  async findOne(id: string): Promise<OrgOwnerClassResponse> {
    const cls = await this.classesRepo.findOne({
      where: { id },
      relations: ['grade'],
    });
    if (!cls) throw new NotFoundException(`class with ID ${id} not found`);
    return {
      gradeName: cls.grade.name,
      id: cls.id,
      name: cls.name,
    };
  }
  async findOneOrFail(id: string) {
    const cls = await this.classesRepo.findOneBy({ id });
    if (!cls) throw new NotFoundException(`class with ID ${id} not found`);
    return cls;
  }

  async update(id: string, updateClassDto: UpdateClassDto) {
    const cls = await this.findOneOrFail(id);

    if (updateClassDto.gradeId) {
      const grade = await this.gradesService.findOneOrFail(cls.grade.id);

      cls.grade = grade;
    }

    Object.assign(cls, updateClassDto);

    return await this.classesRepo.save(cls);
  }

  async remove(id: string) {
    const result = await this.classesRepo.delete({ id });

    if (result.affected === 0) {
      throw new NotFoundException('Class not found');
    }

    return { message: 'Deleted successfully' };
  }
}
