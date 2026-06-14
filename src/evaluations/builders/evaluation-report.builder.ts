import { Injectable } from '@nestjs/common';
import { ReportBuilder, Report } from './report-builder.interface';
import { EvaluationResult } from '../strategies/scoring-strategy.interface';

@Injectable()
export class EvaluationReportBuilder implements ReportBuilder {
  build(result: EvaluationResult, childName: string, evaluationType: string): Report {
    return {
      title: `تقرير تقييم ${evaluationType}`,
      childName,
      evaluationType,
      date: new Date(),
      summary: this.generateSummary(result),
      scores: {
        total: result.totalScore,
        maxTotal: result.maxTotalScore,
        percentage: result.overallPercentage,
      },
      dimensions: result.dimensions.map(d => ({
        name: d.name,
        score: d.score,
        maxScore: d.maxScore,
        percentage: `${d.percentage.toFixed(1)}%`,
        interpretation: d.interpretation,
      })),
      topDimensions: result.topDimensions.map(d => ({
        name: d.name,
        percentage: `${d.percentage.toFixed(1)}%`,
      })),
      interpretation: result.interpretation,
      recommendations: result.recommendations,
    };
  }

  private generateSummary(result: EvaluationResult): string {
    if (result.overallPercentage >= 80) {
      return 'أداء ممتاز - الطفل يظهر قدرات عالية في المجالات المقاسة';
    } else if (result.overallPercentage >= 60) {
      return 'أداء جيد جداً - الطفل يظهر قدرات قوية في معظم المجالات';
    } else if (result.overallPercentage >= 40) {
      return 'أداء متوسط - الطفل يظهر قدرات متوسطة في المجالات المقاسة';
    } else {
      return 'أداء يحتاج دعم - يوصى بتقديم دعم إضافي للطفل';
    }
  }
}
