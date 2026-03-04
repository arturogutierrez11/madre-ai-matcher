import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { MadreRepository } from '../../infrastructure/repositories/madre.repository';
import { FravegaCategoriesRepository } from '../../infrastructure/repositories/fravega-categories.repository';
import { OpenAIRepository } from '../../infrastructure/repositories/openai.repository';
import { CategoryMatchRepository } from '../../infrastructure/repositories/category-match.repository';
import { MatchFravegaCategoriesUseCase } from 'src/application/use-case/match-fravega-categories.usecase';
import { MatchController } from './matcher.controller';

@Module({
  imports: [HttpModule],
  controllers: [MatchController],
  providers: [
    MatchFravegaCategoriesUseCase,

    {
      provide: 'IMadreRepository',
      useClass: MadreRepository,
    },
    {
      provide: 'ICategoriesRepository',
      useClass: FravegaCategoriesRepository,
    },
    {
      provide: 'IOpenAIRepository',
      useClass: OpenAIRepository,
    },
    {
      provide: 'ICategoryMatchRepository',
      useClass: CategoryMatchRepository,
    },
  ],
})
export class MatcherModule {}
