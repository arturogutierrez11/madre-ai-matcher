import { Controller, Get, Query } from '@nestjs/common';
import { MatchFravegaCategoriesUseCase } from 'src/application/use-case/match-fravega-categories.usecase';

@Controller('matcher')
export class MatchController {
  constructor(private readonly useCase: MatchFravegaCategoriesUseCase) {}

  @Get('run')
  run(@Query('offset') offset = 0, @Query('limit') limit = 50) {
    // Ejecuta el proceso en background
    this.useCase
      .execute(Number(offset), Number(limit))
      .catch((err) => console.error('Matcher error:', err));

    // Responde inmediatamente
    return {
      message: 'Matching process started',
      offset: Number(offset),
      limit: Number(limit),
    };
  }
}
