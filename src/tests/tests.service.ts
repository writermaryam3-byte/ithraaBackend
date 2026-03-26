import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateTestAssignmentDto,
  CreateTestDto,
  SubmitTestDto,
} from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { Repository } from 'typeorm';
import { Test } from '@nestjs/testing';
import { InjectRepository } from '@nestjs/typeorm';
import { TestAssignment } from './entities/test-assignment.entity';
import { TestResult } from './entities/test-result.entity';
import { Child } from 'src/children/entities/child.entity';

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test) private readonly testRepo: Repository<Test>,
    @InjectRepository(TestAssignment)
    private readonly assignmentRepo: Repository<TestAssignment>,
    @InjectRepository(TestResult)
    private readonly resultRepo: Repository<TestResult>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}
  async create(dto: CreateTestDto) {
    const test = this.testRepo.create({
      title: dto.title,
      description: dto.description,
      questionNo: dto.questions.length,
      questions: dto.questions.map((q) => ({
        content: q.content,
        answers: q.answers,
      })),
    });

    return this.testRepo.save(test);
  }

  async createAssignment(dto: CreateTestAssignmentDto) {
    const child = await this.childRepo.findOne({ where: { id: dto.childId } });
    if (!child) throw new NotFoundException('Child not found');

    const test = await this.findOne(dto.testId);

    const assignment = this.assignmentRepo.create({
      child,
      test,
      due_date: new Date(dto.due_date),
      status: 'pending',
    });

    return this.assignmentRepo.save(assignment);
  }

  async submit(dto: SubmitTestDto) {
    const assignment = await this.findOneAssignment(dto.assignmentId);

    let totalScore = 0;

    for (const userAnswer of dto.answers) {
      const question = assignment.test.questions.find(
        (q) => q.id === userAnswer.questionId,
      );

      if (!question) throw new NotFoundException('question not found');
      const answer = question.answers.find((a) => a.id === userAnswer.answerId);

      if (answer) {
        totalScore += answer.score;
      }
    }

    const result = this.resultRepo.create({
      assignment,
      score: totalScore,
      answers_json: JSON.stringify(dto.answers),
      created_at: new Date(),
    });

    return this.resultRepo.save(result);
  }

  findAll() {
    return this.testRepo.findAndCount({
      relations: ['questions', 'questions.answers'],
    });
  }

  async findOne(id: string) {
    const test = await this.testRepo.findOne({
      where: { id },
      relations: ['questions', 'questions.answers'],
      order: {
        questions: {
          id: 'ASC',
        },
      },
    });

    if (!test) {
      throw new NotFoundException('Test not found');
    }

    return test;
  }

  async findOneAssignment(id: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ['test', 'test.questions', 'test.questions.answers'],
    });
    if (!assignment) throw new NotFoundException('assignment not found');
    return assignment;
  }

  update(id: number, updateTestDto: UpdateTestDto) {
    return `This action updates a #${id} test`;
  }

  remove(id: number) {
    return `This action removes a #${id} test`;
  }
}
