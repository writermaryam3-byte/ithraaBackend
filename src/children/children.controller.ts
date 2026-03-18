import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from 'src/common/enums/role.enum';

@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}
  @Roles(
    UserRole.EMPLOYEE,
    UserRole.ORGANIZATIONOWNER,
    UserRole.PARENT,
    UserRole.TEACHER,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@Body() createChildDto: CreateChildDto) {
    return this.childrenService.create(createChildDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('all')
  findAll() {
    return this.childrenService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findByUser(@Query('userId', new ParseUUIDPipe()) userId: string) {
    return this.childrenService.findByUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.childrenService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChildDto: UpdateChildDto) {
    return this.childrenService.update(id, updateChildDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.childrenService.remove(id);
  }
}
