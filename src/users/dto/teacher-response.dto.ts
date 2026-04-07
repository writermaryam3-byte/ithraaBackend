import { IUserResponseDto } from './user-response.dto';

export interface ITeacherResponseDto extends IUserResponseDto {
  jobTitle: string;
  organizationId: string;
}
