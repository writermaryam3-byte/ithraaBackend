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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.employeesService.findAll();
  }
  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER)
  @Get('organization/:organizationId')
  findByOrganization(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.employeesService.findByOrganization(organizationId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
