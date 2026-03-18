import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { Child } from './entities/child.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private childrenRepository: Repository<Child>,
  ) {}

  create(createChildDto: CreateChildDto) {
    return this.childrenRepository.save({
      ...createChildDto,
      user: { id: createChildDto.user_id },
    });
  }

  async findAll() {
    const [children, count] = await this.childrenRepository.findAndCount();

    return { children, count };
  }

  async findByUser(userId: string) {
    const [children, count] = await this.childrenRepository.findAndCount({
      where: { user: { id: userId } },
    });
    return { children, count };
  }

  async findOne(id: string) {
    const child = await this.childrenRepository.findBy({ id });
    if (!child) throw new NotFoundException('child not found');
    return child;
  }

  async update(id: string, updateChildDto: UpdateChildDto) {
    const child = await this.childrenRepository.preload({
      id,
      ...updateChildDto,
    });
    if (!child) throw new NotFoundException('child not found');
    return this.childrenRepository.save(child);
  }

  remove(id: string) {
    return this.childrenRepository.delete(id);
  }
}
