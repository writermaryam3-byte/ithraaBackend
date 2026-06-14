import { Injectable } from '@nestjs/common';
import { EvaluationType } from '../enums/evaluation-type.enum';
import { ScoringStrategy } from './scoring-strategy.interface';
import { MultipleIntelligencesStrategy } from './multiple-intelligences.strategy';
import { HollandStrategy } from './holland.strategy';
import { RenzulliStrategy } from './renzulli.strategy';

@Injectable()
export class ScoringStrategyFactory {
  constructor(
    private multipleIntelligencesStrategy: MultipleIntelligencesStrategy,
    private hollandStrategy: HollandStrategy,
    private renzulliStrategy: RenzulliStrategy,
  ) {}

  getStrategy(type: EvaluationType): ScoringStrategy {
    switch (type) {
      case EvaluationType.MULTIPLE_INTELLIGENCES:
        return this.multipleIntelligencesStrategy;
      case EvaluationType.HOLLAND:
        return this.hollandStrategy;
      case EvaluationType.RENZULLI:
        return this.renzulliStrategy;
      case EvaluationType.PRIDE:
      case EvaluationType.LEARNING_STYLES:
      case EvaluationType.TORRANCE:
      default:
        return this.multipleIntelligencesStrategy;
    }
  }
}
