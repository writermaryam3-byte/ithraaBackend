import { GradeName } from 'src/common/enums/grade-name.enum';

export interface BaseGradeResponseDto {
  name: GradeName;
  id: string;
}
