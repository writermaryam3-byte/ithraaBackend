import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationDimension } from './entities/evaluation-dimension.entity';
import { EvaluationQuestion } from './entities/evaluation-question.entity';
import { EvaluationQuestionAnswer } from './entities/evaluation-question-answer.entity';
import { EvaluationType } from './enums/evaluation-type.enum';

@Injectable()
export class EvaluationSeedingService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationSeedingService.name);

  constructor(
    @InjectRepository(Evaluation)
    private evaluationRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationDimension)
    private dimensionRepo: Repository<EvaluationDimension>,
    @InjectRepository(EvaluationQuestion)
    private questionRepo: Repository<EvaluationQuestion>,
    @InjectRepository(EvaluationQuestionAnswer)
    private answerRepo: Repository<EvaluationQuestionAnswer>,
  ) {}

  async onModuleInit() {
    await this.seedEvaluations();
  }

  private async seedEvaluations() {
    this.logger.log('Starting evaluation seeding...');
    await this.seedMultipleIntelligences();
    await this.seedPride();
    await this.seedRenzulli();
    await this.seedHolland();
    await this.seedLearningStyles();
    await this.seedTorrance();
    this.logger.log('Evaluation seeding complete!');
  }

  private async seedMultipleIntelligences() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.MULTIPLE_INTELLIGENCES },
    });
    if (existing) {
      this.logger.log('Multiple Intelligences evaluation already exists');
      return;
    }

    this.logger.log('Seeding Multiple Intelligences evaluation...');
    const evaluation = this.evaluationRepo.create({
      type: EvaluationType.MULTIPLE_INTELLIGENCES,
      title: 'مقياس الذكاءات الثمانية',
      institutionId: null,
      ageFrom: 6,
      ageTo: 18,
      evaluatorTypes: ['parent', 'teacher'],
    });
    const savedEvaluation = await this.evaluationRepo.save(evaluation);

    const dimensionsData = [
      { name: 'الذكاء اللغوي', code: 'linguistic', minScore: 0, maxScore: 40 },
      {
        name: 'الذكاء المنطقي الرياضي',
        code: 'logical',
        minScore: 0,
        maxScore: 40,
      },
      { name: 'الذكاء المكاني', code: 'spatial', minScore: 0, maxScore: 40 },
      {
        name: 'الذكاء الجسدي الحركي',
        code: 'bodily',
        minScore: 0,
        maxScore: 40,
      },
      { name: 'الذكاء الموسيقي', code: 'musical', minScore: 0, maxScore: 40 },
      {
        name: 'الذكاء الاجتماعي',
        code: 'interpersonal',
        minScore: 0,
        maxScore: 40,
      },
      {
        name: 'الذكاء الشخصي',
        code: 'intrapersonal',
        minScore: 0,
        maxScore: 40,
      },
      { name: 'الذكاء الطبيعي', code: 'naturalist', minScore: 0, maxScore: 40 },
    ];

    for (const dimData of dimensionsData) {
      const dimension = this.dimensionRepo.create({
        ...dimData,
        evaluation: savedEvaluation,
        evaluationId: savedEvaluation.id,
      });
      const savedDimension = await this.dimensionRepo.save(dimension);
      await this.seedSampleQuestions(savedEvaluation, savedDimension);
    }
  }

  private async seedPride() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.PRIDE },
    });
    if (existing) {
      this.logger.log('Pride evaluation already exists');
      return;
    }
    this.logger.log('Seeding Pride evaluation...');
    const evaluation = this.evaluationRepo.create({
      type: EvaluationType.PRIDE,
      title: 'مقياس برايد',
      institutionId: null,
      ageFrom: 6,
      ageTo: 18,
      evaluatorTypes: ['parent', 'teacher'],
    });
    await this.evaluationRepo.save(evaluation);
  }

  private async seedRenzulli() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.RENZULLI },
    });
    if (existing) {
      this.logger.log('Renzulli evaluation already exists');
      return;
    }
    this.logger.log('Seeding Renzulli evaluation...');
    const evaluation = this.evaluationRepo.create({
      type: EvaluationType.RENZULLI,
      title: 'مقياس رنزولي للسمات السلوكية',
      institutionId: null,
      ageFrom: 6,
      ageTo: 18,
      evaluatorTypes: ['teacher'],
    });
    await this.evaluationRepo.save(evaluation);
  }

  private async seedHolland() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.HOLLAND },
    });
    if (existing) {
      this.logger.log('Holland evaluation already exists');
      return;
    }
    this.logger.log('Seeding Holland evaluation...');
    const evaluation = this.evaluationRepo.create({
      type: EvaluationType.HOLLAND,
      title: 'مقياس هولاند المهني',
      institutionId: null,
      ageFrom: 12,
      ageTo: 25,
      evaluatorTypes: ['student', 'teacher'],
    });
    await this.evaluationRepo.save(evaluation);
  }

  private async seedLearningStyles() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.LEARNING_STYLES },
    });
    if (existing) {
      this.logger.log('Learning Styles evaluation already exists');
      return;
    }
    this.logger.log('Seeding Learning Styles evaluation...');
    const evaluation = this.evaluationRepo.create({
      type: EvaluationType.LEARNING_STYLES,
      title: 'مقياس أساليب التعلم',
      institutionId: null,
      ageFrom: 6,
      ageTo: 18,
      evaluatorTypes: ['parent', 'teacher'],
    });
    await this.evaluationRepo.save(evaluation);
  }

  private async seedTorrance() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.TORRANCE },
    });
    if (existing) {
      this.logger.log('Torrance evaluation already exists');
      return;
    }
    this.logger.log('Seeding Torrance evaluation...');
    const evaluation = this.evaluationRepo.create({
      type: EvaluationType.TORRANCE,
      title: 'مقياس تورانس للإبداع',
      institutionId: null,
      ageFrom: 6,
      ageTo: 18,
      evaluatorTypes: ['teacher', 'specialist'],
    });
    await this.evaluationRepo.save(evaluation);
  }

  private async seedSampleQuestions(
    evaluation: Evaluation,
    dimension: EvaluationDimension,
  ) {
    const sampleQuestion = this.questionRepo.create({
      evaluation,
      evaluationId: evaluation.id,
      evaluationDimension: dimension,
      evaluationDimensionId: dimension.id,
      content: 'سؤال عينة؟',
      order: 1,
    });
    const savedQuestion = await this.questionRepo.save(sampleQuestion);

    const answer1 = this.answerRepo.create({
      questionId: savedQuestion.id,
      text: 'دائماً',
      scoreValue: 5,
      order: 1,
    });
    const answer2 = this.answerRepo.create({
      questionId: savedQuestion.id,
      text: 'غالباً',
      scoreValue: 4,
      order: 2,
    });
    await this.answerRepo.save([answer1, answer2]);
  }
}
