import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { MatchController } from './matcher.controller';

/* USE CASES */
import { MatchMeliFravegaCategoriesUseCase } from 'src/application/use-case/match-meli-fravega-categories.usecase';
import { MatchMeliFravegaBrandsUseCase } from 'src/application/use-case/match-meli-fravega-brands.usecase';

/* CATEGORY REPOSITORIES */
import { FravegaCategoriesRepository } from '../../infrastructure/repositories/fravega-categories.repository';
import { MeliCategoriesRepository } from '../../infrastructure/repositories/meli-categories.repository';
import { MadreCategoryMatchRepository } from '../../infrastructure/repositories/madre-category-match.repository';

/* BRAND REPOSITORIES */

/* OPENAI */
import { OpenAIRepository } from '../../infrastructure/repositories/openai.repository';
import { MeliBrandsRepository } from 'src/infrastructure/repositories/MeliBrandsRepository';
import { FravegaBrandsRepository } from 'src/infrastructure/repositories/FravegaBrandsRepository';
import { BrandMatchRepository } from 'src/infrastructure/repositories/BrandMatchRepository';

@Module({
  imports: [HttpModule],

  controllers: [MatchController],

  providers: [
    /* USE CASES */
    MatchMeliFravegaCategoriesUseCase,
    MatchMeliFravegaBrandsUseCase,

    /* CATEGORY DEPENDENCIES */
    {
      provide: 'ICategoriesRepository',
      useClass: FravegaCategoriesRepository,
    },
    {
      provide: 'IMeliCategoriesRepository',
      useClass: MeliCategoriesRepository,
    },
    {
      provide: 'IMadreCategoryMatchRepository',
      useClass: MadreCategoryMatchRepository,
    },

    /* BRAND DEPENDENCIES */
    {
      provide: 'IMeliBrandsRepository',
      useClass: MeliBrandsRepository,
    },
    {
      provide: 'IFravegaBrandsRepository',
      useClass: FravegaBrandsRepository,
    },
    {
      provide: 'IBrandMatchRepository',
      useClass: BrandMatchRepository,
    },

    /* OPENAI */
    {
      provide: 'IOpenAIRepository',
      useClass: OpenAIRepository,
    },
  ],
})
export class MatcherModule {}
