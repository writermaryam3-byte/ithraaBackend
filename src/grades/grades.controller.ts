import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
@ApiTags('grades')
@ApiBearerAuth()
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createGradeDto: CreateGradeDto) {
    return this.gradesService.create(createGradeDto);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.gradesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.gradesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateGradeDto: UpdateGradeDto,
  ) {
    return this.gradesService.update(+id, updateGradeDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.gradesService.remove(+id);
  }
}
