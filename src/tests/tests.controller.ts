import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TestsService } from './tests.service';
import {
  CreateTestAssignmentDto,
  CreateTestDto,
  SubmitTestDto,
} from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { UserRole } from 'src/common/enums/role.enum';
import { Roles } from 'src/users/decorators/role.decorator';

@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() createTestDto: CreateTestDto) {
    return this.testsService.create(createTestDto);
  }

  @Post('test-assignments')
  createAssignment(@Body() dto: CreateTestAssignmentDto) {
    return this.testsService.createAssignment(dto);
  }

  // @Get('test-assignments')
  // findTestAssignments(){
  //   return this.testsService.findOneAssignment();
  // }

  @Post('test-results/submit')
  submitTest(@Body() dto: SubmitTestDto) {
    return this.testsService.submit(dto);
  }

  @Get()
  async findAll() {
    const [tests, count] = await this.testsService.findAll();
    return { tests, count };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.testsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTestDto: UpdateTestDto) {
    return this.testsService.update(+id, updateTestDto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.testsService.remove(+id);
  }
}
