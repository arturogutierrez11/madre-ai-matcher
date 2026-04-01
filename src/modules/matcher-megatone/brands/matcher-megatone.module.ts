import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

/* USE CASE */

/* REPOSITORIES */
import { MeliBrandsRepository } from 'src/infrastructure/repositories/MeliBrandsRepository';
import { MegatoneBrandsRepository } from 'src/infrastructure/repositories/megatone/brands/MegatoneBrandsRepository';
import { MegatoneBrandMatchRepository } from 'src/infrastructure/repositories/megatone/madre/MegatoneBrandMatchRepository';
import { OpenAIRepository } from 'src/infrastructure/repositories/openai.repository';
import { MatchMeliMegatoneBrandsUseCase } from 'src/application/use-case/megatone/MatchMeliMegatoneBrandsUseCase';
import { MatchBrandsMegatoneController } from './MatchBrandsMegatone.Controller';

@Module({
  imports: [HttpModule],

  controllers: [MatchBrandsMegatoneController],

  providers: [
    /* USE CASE */
    MatchMeliMegatoneBrandsUseCase,

    /* MELI */
    {
      provide: 'IMeliBrandsRepository',
      useClass: MeliBrandsRepository,
    },

    /* MEGATONE */
    {
      provide: 'IMegatoneBrandsRepository',
      useClass: MegatoneBrandsRepository,
    },
    {
      provide: 'IMegatoneBrandMatchRepository',
      useClass: MegatoneBrandMatchRepository,
    },

    /* OPENAI */
    {
      provide: 'IOpenAIRepository',
      useClass: OpenAIRepository,
    },
  ],
})
export class MatcherMegatoneBrandsModule {}
