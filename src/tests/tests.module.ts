import { Module } from '@nestjs/common';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from './entities/test.entity';
import { TestResult } from './entities/test-result.entity';
import { TestAssignment } from './entities/test-assignment.entity';
import { Question } from './entities/question.entity';
import { Answer } from './entities/answer.entity';
import { Child } from 'src/children/entities/child.entity';

@Module({
  controllers: [TestsController],
  providers: [TestsService],
  imports: [
    TypeOrmModule.forFeature([
      Test,
      TestResult,
      TestAssignment,
      Question,
      Answer,
      Child,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class TestsModule {}
