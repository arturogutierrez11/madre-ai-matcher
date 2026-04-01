import { Controller, Get } from '@nestjs/common';
import { MatchMeliMegatoneBrandsUseCase } from 'src/application/use-case/megatone/MatchMeliMegatoneBrandsUseCase';

@Controller('matcher/megatone/brands')
export class MatchBrandsMegatoneController {
  constructor(
    private readonly megatoneBrandsUseCase: MatchMeliMegatoneBrandsUseCase,
  ) {}

  @Get('run')
  runMegatoneBrands() {
    this.megatoneBrandsUseCase.execute().catch((err) => {
      console.error('Megatone brands matcher error:', err);
    });

    return {
      message: 'ML → Megatone brands matching started',
    };
  }
}
