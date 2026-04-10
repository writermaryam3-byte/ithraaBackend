import { GradeName } from 'src/common/enums/grade-name.enum';
import { BaseClassResponse } from './base-class-response.dto';
import { Child } from 'src/children/entities/child.entity';

export interface OrgOwnerClassResponse extends BaseClassResponse {
  gradeName: GradeName;
  children: Partial<Child>[];
}
