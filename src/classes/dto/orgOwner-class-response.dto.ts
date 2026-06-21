import { GradeName } from 'src/common/enums/grade-name.enum';
import { BaseClassResponse } from './base-class-response.dto';
import { OrganizationChild } from 'src/children/entities/organization-child.entity';

export interface OrgOwnerClassResponse extends BaseClassResponse {
  gradeName: GradeName;
  children: Partial<OrganizationChild>[];
}
