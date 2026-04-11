import { UserRole } from 'src/common/enums/role.enum';

export class EmployeeResponseDto {
  id: string;

  jobTitle: string;

  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };

  organization: {
    id: string;
    name: string;
  };
}
