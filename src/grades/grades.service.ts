import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Grade } from './entities/grade.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminGradeResponseDto } from './dto/admin-grade-response.dto';

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
  ) {}
  async create(createGradeDto: CreateGradeDto) {
    const grade = await this.gradeRepo.save({
      ...createGradeDto,
      organization: { id: createGradeDto.organizationId },
    });
    return grade;
  }

  async findAll(): Promise<AdminGradeResponseDto[]> {
    const grades = await this.gradeRepo.find({
      relations: { organization: true },
    });
    console.log(grades);
    return grades.map((g) => ({
      id: g.id,
      name: g.name,
      organizationName: g.organization.organization_name,
    }));
  }

  async findOne(id: string) {
    const grade = await this.gradeRepo.findOne({ where: { id } });
    if (!grade) throw new NotFoundException(`Grade with ID ${id} not found`);
    return grade;
  }
  async findOneOrFail(id: string) {
    const grade = await this.gradeRepo.findOneBy({ id });
    if (!grade) throw new NotFoundException(`Grade with ID ${id} not found`);
    return grade;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: number, updateGradeDto: UpdateGradeDto) {
    return `This action updates a #${id} grade`;
  }

  remove(id: number) {
    return `This action removes a #${id} grade`;
  }
}
