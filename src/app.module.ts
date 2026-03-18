import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatcherModule } from './modules/matcher/matcher.module';
import { MatcherMegatoneModule } from './modules/matcher-megatone/matcher-megatone.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MatcherModule,
    MatcherMegatoneModule,
  ],
})
export class AppModule {}
