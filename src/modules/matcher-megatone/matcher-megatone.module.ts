import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

/* CONTROLLER */
import { MatchController } from './matcher.controller';

/* USE CASE */
import { MatchMeliMegatoneCategoriesUseCase } from 'src/application/use-case/megatone/match-meli-megatone-categories.usecase';

/* REPOSITORIES */
import { MeliCategoriesRepository } from 'src/infrastructure/repositories/meli-categories.repository';
import { MegatoneCategoriesRepository } from 'src/infrastructure/repositories/megatone/categories/MegatoneCategoriesRepository';
import { MadreMegatoneCategoryMatchRepository } from 'src/infrastructure/repositories/megatone/madre/madre-megatone-category-match.repository';
import { OpenAIRepository } from 'src/infrastructure/repositories/openai.repository';

@Module({
  imports: [HttpModule],

  controllers: [MatchController],

  providers: [
    /* USE CASE */
    MatchMeliMegatoneCategoriesUseCase,

    /* MELI */
    {
      provide: 'IMeliCategoriesRepository',
      useClass: MeliCategoriesRepository,
    },

    /* MEGATONE */
    {
      provide: 'IMegatoneCategoriesRepository',
      useClass: MegatoneCategoriesRepository,
    },
    {
      provide: 'IMadreMegatoneCategoryMatchRepository',
      useClass: MadreMegatoneCategoryMatchRepository,
    },

    /* OPENAI */
    {
      provide: 'IOpenAIRepository',
      useClass: OpenAIRepository,
    },
  ],
})
export class MatcherMegatoneModule {}
