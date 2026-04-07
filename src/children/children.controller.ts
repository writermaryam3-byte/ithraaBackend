import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { UserRole } from 'src/common/enums/role.enum';
import { Roles } from 'src/users/decorators/role.decorator';

@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}
  @Roles(
    UserRole.EMPLOYEE,
    UserRole.ORGANIZATIONOWNER,
    UserRole.PARENT,
    UserRole.TEACHER,
  )
  @Post()
  create(@Body() createChildDto: CreateChildDto) {
    return this.childrenService.create(createChildDto);
  }

  @Roles(UserRole.ADMIN)
  @Get('all')
  findAll() {
    return this.childrenService.findAll();
  }

  @Get()
  findByUser(@Query('userId', new ParseUUIDPipe()) userId: string) {
    return this.childrenService.findByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.childrenService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChildDto: UpdateChildDto) {
    return this.childrenService.update(id, updateChildDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.childrenService.remove(id);
  }
}
