import { Controller, Get } from '@nestjs/common';
import { MatchMeliFravegaCategoriesUseCase } from 'src/application/use-case/match-meli-fravega-categories.usecase';

@Controller('matcher')
export class MatchController {
  constructor(private readonly useCase: MatchMeliFravegaCategoriesUseCase) {}

  @Get('run')
  run() {
    this.useCase.execute().catch((err) => {
      console.error('Matcher error:', err);
    });

    return {
      message: 'ML → Fravega matching started',
    };
  }
}
