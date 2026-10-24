import { Body, Controller, Post } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportDto } from './dto/create-support.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  async createSupport(
    @Body() createSupportDto: CreateSupportDto,
  ): Promise<unknown> {
    return this.supportService.createSupport(createSupportDto);
  }
}
