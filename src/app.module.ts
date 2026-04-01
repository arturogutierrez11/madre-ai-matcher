import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatcherModule } from './modules/matcher/matcher.module';
import { MatcherMegatoneModule } from './modules/matcher-megatone/matcher-megatone.module';
import { MatcherMegatoneBrandsModule } from './modules/matcher-megatone/brands/matcher-megatone.module';
import { FravegaImagesSyncModule } from './modules/fravega-images-sync/fravega-images-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MatcherModule,
    MatcherMegatoneModule,
    MatcherMegatoneBrandsModule,
    FravegaImagesSyncModule,
  ],
})
export class AppModule {}
