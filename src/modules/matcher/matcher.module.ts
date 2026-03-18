import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { MatchController } from './matcher.controller';

/* USE CASES */
// import { MatchMeliFravegaCategoriesUseCase } from 'src/application/use-case/match-meli-fravega-categories.usecase';
import { MatchMeliFravegaBrandsUseCase } from 'src/application/use-case/match-meli-fravega-brands.usecase';

/* CATEGORY REPOSITORIES */
import { FravegaCategoriesRepository } from '../../infrastructure/repositories/fravega-categories.repository';
import { MeliCategoriesRepository } from '../../infrastructure/repositories/meli-categories.repository';
// import { MadreCategoryMatchRepository } from '../../infrastructure/repositories/madre-category-match.repository';

/* MEGATONE */

/* BRAND REPOSITORIES */
import { MeliBrandsRepository } from 'src/infrastructure/repositories/MeliBrandsRepository';
import { FravegaBrandsRepository } from 'src/infrastructure/repositories/FravegaBrandsRepository';
import { BrandMatchRepository } from 'src/infrastructure/repositories/BrandMatchRepository';

/* OPENAI */
import { OpenAIRepository } from '../../infrastructure/repositories/openai.repository';
import { MatchMeliMegatoneCategoriesUseCase } from 'src/application/use-case/megatone/match-meli-megatone-categories.usecase';
import { MegatoneCategoriesRepository } from 'src/infrastructure/repositories/megatone/categories/MegatoneCategoriesRepository';
import * as Repo from 'src/infrastructure/repositories/megatone/madre/madre-megatone-category-match.repository';

const { MadreMegatoneCategoryMatchRepository } = Repo;
@Module({
  imports: [HttpModule],

  controllers: [MatchController],

  providers: [
    /* =========================
       USE CASES
    ========================= */
    // MatchMeliFravegaCategoriesUseCase,
    MatchMeliMegatoneCategoriesUseCase,
    MatchMeliFravegaBrandsUseCase,

    /* =========================
       CATEGORY DEPENDENCIES
    ========================= */

    // 👉 Fravega (comentado)
    {
      provide: 'ICategoriesRepository',
      useClass: FravegaCategoriesRepository,
    },
    {
      provide: 'IMeliCategoriesRepository',
      useClass: MeliCategoriesRepository,
    },
    // {
    //   provide: 'IMadreCategoryMatchRepository',
    //   useClass: MadreCategoryMatchRepository,
    // },

    // 👉 Megatone (activo)
    {
      provide: 'IMegatoneCategoriesRepository',
      useClass: MegatoneCategoriesRepository,
    },
    {
      provide: 'IMadreMegatoneCategoryMatchRepository',
      useClass: MadreMegatoneCategoryMatchRepository,
    },

    /* =========================
       BRAND DEPENDENCIES
    ========================= */
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

    /* =========================
       OPENAI
    ========================= */
    {
      provide: 'IOpenAIRepository',
      useClass: OpenAIRepository,
    },
  ],
})
export class MatcherModule {}
