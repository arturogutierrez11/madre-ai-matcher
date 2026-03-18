import { Controller, Get } from '@nestjs/common';

// import { MatchMeliFravegaCategoriesUseCase } from 'src/application/use-case/match-meli-fravega-categories.usecase';
import { MatchMeliFravegaBrandsUseCase } from 'src/application/use-case/match-meli-fravega-brands.usecase';

@Controller('matcher')
export class MatchController {
  constructor(
    // private readonly categoriesUseCase: MatchMeliFravegaCategoriesUseCase,
    private readonly brandsUseCase: MatchMeliFravegaBrandsUseCase,
  ) {}

  //   @Get('run-categories')
  //   runCategories() {
  //     this.categoriesUseCase.execute().catch((err) => {
  //       console.error('Categories matcher error:', err);
  //     });
  //
  //     return {
  //       message: 'ML → Fravega categories matching started',
  //     };
  //   }

  @Get('run-brands')
  runBrands() {
    this.brandsUseCase.execute().catch((err) => {
      console.error('Brands matcher error:', err);
    });

    return {
      message: 'ML → Fravega brands matching started',
    };
  }
}
