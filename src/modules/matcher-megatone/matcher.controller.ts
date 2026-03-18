import { Controller, Get } from '@nestjs/common';
import { MatchMeliMegatoneCategoriesUseCase } from 'src/application/use-case/megatone/match-meli-megatone-categories.usecase';

@Controller('matcher')
export class MatchController {
  constructor(
    private readonly megatoneCategoriesUseCase: MatchMeliMegatoneCategoriesUseCase,
  ) {}

  @Get('run-megatone-categories')
  runMegatoneCategories() {
    this.megatoneCategoriesUseCase.execute().catch((err) => {
      console.error('Megatone matcher error:', err);
    });

    return {
      message: 'ML → Megatone categories matching started',
    };
  }
}
