import { EvaluationAttempt } from '../entities/evaluation-attempt.entity';

export interface DimensionScore {
  code: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  interpretation: string;
}

export interface EvaluationResult {
  totalScore: number;
  maxTotalScore: number;
  overallPercentage: number;
  dimensions: DimensionScore[];
  topDimensions: DimensionScore[];
  interpretation: string;
  recommendations: string[];
}

export interface ScoringStrategy {
  calculate(attempt: EvaluationAttempt): Promise<EvaluationResult>;
  getType(): string;
}
