import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/common/enums/role.enum';
import { Roles } from '../decorators/role.decorator';
import { TeachersProvider } from '../services/teachers.provider';
import { CreateTeacherDto } from '../dto/create-teacher.dto';
import { UpdateClassDto } from 'src/classes/dto/update-class.dto';
import { UsersService } from '../services/users.service';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachersServieces: TeachersProvider,
    private readonly usersServices: UsersService,
  ) {}
  @ApiOperation({ summary: 'Created new Teacher' })
  @ApiResponse({ status: 201, description: 'teacher created successfully' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createTeahcerDto: CreateTeacherDto) {
    return this.teachersServieces.create(createTeahcerDto);
  }

  @ApiOperation({ summary: 'Update a class' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto) {
    return this.teachersServieces.update(id, updateClassDto);
  }

  @ApiOperation({ summary: 'Delete a class' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersServices.remove(id);
  }
}
