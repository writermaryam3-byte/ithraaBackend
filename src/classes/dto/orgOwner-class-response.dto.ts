import { GradeName } from 'src/common/enums/grade-name.enum';
import { BaseClassResponse } from './base-class-response.dto';

export interface OrgOwnerClassResponse extends BaseClassResponse {
  gradeName: GradeName;
}
