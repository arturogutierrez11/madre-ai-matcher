import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { MatchController } from './matcher.controller';

import { MatchMeliFravegaCategoriesUseCase } from 'src/application/use-case/match-meli-fravega-categories.usecase';

import { FravegaCategoriesRepository } from '../../infrastructure/repositories/fravega-categories.repository';
import { OpenAIRepository } from '../../infrastructure/repositories/openai.repository';
import { MeliCategoriesRepository } from '../../infrastructure/repositories/meli-categories.repository';
import { MadreCategoryMatchRepository } from '../../infrastructure/repositories/madre-category-match.repository';

@Module({
  imports: [HttpModule],

  controllers: [MatchController],

  providers: [
    MatchMeliFravegaCategoriesUseCase,

    {
      provide: 'ICategoriesRepository',
      useClass: FravegaCategoriesRepository,
    },
    {
      provide: 'IOpenAIRepository',
      useClass: OpenAIRepository,
    },
    {
      provide: 'IMeliCategoriesRepository',
      useClass: MeliCategoriesRepository,
    },
    {
      provide: 'IMadreCategoryMatchRepository',
      useClass: MadreCategoryMatchRepository,
    },
  ],
})
export class MatcherModule {}
