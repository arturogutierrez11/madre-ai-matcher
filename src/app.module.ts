import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatcherModule } from './modules/matcher/matcher.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MatcherModule,
  ],
})
export class AppModule {}
