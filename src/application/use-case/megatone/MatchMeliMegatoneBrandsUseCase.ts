import { Inject, Injectable } from '@nestjs/common';
import cliProgress from 'cli-progress';

import type { IMeliBrandsRepository } from 'src/domains/interface/brands/IMeliBrandsRepository';
import type { IOpenAIRepository } from 'src/domains/interface/openai.repository.interface';

import { MegatoneBrandsRepository } from 'src/infrastructure/repositories/megatone/brands/MegatoneBrandsRepository';
import { MegatoneBrandMatchRepository } from 'src/infrastructure/repositories/megatone/madre/MegatoneBrandMatchRepository';

@Injectable()
export class MatchMeliMegatoneBrandsUseCase {
  constructor(
    @Inject('IMeliBrandsRepository')
    private readonly meliBrandsRepository: IMeliBrandsRepository,

    @Inject('IMegatoneBrandsRepository')
    private readonly megatoneBrandsRepository: MegatoneBrandsRepository,

    @Inject('IMegatoneBrandMatchRepository')
    private readonly madreRepository: MegatoneBrandMatchRepository,

    @Inject('IOpenAIRepository')
    private readonly openAIRepository: IOpenAIRepository,
  ) {}

  async execute() {
    console.log('==============================');
    console.log('Starting ML → Megatone BRAND matcher');
    console.log('==============================');

    const megatoneBrands = await this.megatoneBrandsRepository.getBrands();

    let page = 1;
    const limit = 100;

    while (true) {
      const meliBrands = await this.meliBrandsRepository.getBrands(page, limit);

      if (!meliBrands.length) break;

      for (const meliBrand of meliBrands) {
        try {
          if (!meliBrand || meliBrand.length < 2) continue;

          console.log('------------------------------');
          console.log('Processing:', meliBrand);

          /** 🔎 candidatos */
          let candidates = this.findCandidates(meliBrand, megatoneBrands);

          /** 🔥 SI NO HAY → usar TODAS */
          if (candidates.length === 0) {
            candidates = megatoneBrands;
          }

          /** ⚡ exact match */
          const exact = candidates.find(
            (c) => this.normalize(c.name) === this.normalize(meliBrand),
          );

          if (exact) {
            console.log('EXACT MATCH FOUND:', exact.name);

            await this.madreRepository.saveMatch({
              meliBrand,
              megatoneBrandId: exact.id,
              megatoneBrandName: exact.name,
              confidence: 1,
            });

            continue;
          }

          /** 🤖 OpenAI */
          const match = await this.openAIRepository.matchBrand(
            meliBrand,
            candidates.slice(0, 20),
          );

          console.log('AI RESULT:', match);

          if (!match.brandId || match.confidence < 0.7) {
            console.log('❌ LOW CONFIDENCE');
            continue;
          }

          /** 💾 SAVE SIEMPRE */
          console.log('💾 SAVING...');

          await this.madreRepository.saveMatch({
            meliBrand,
            megatoneBrandId: match.brandId!,
            megatoneBrandName: match.brandName!,
            confidence: match.confidence,
          });

          console.log('✅ SAVED');
        } catch (error) {
          console.error('❌ ERROR:', meliBrand, error);
        }
      }

      page++;
    }

    console.log('DONE');
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findCandidates(meliBrand: string, brands: any[]) {
    const normalized = this.normalize(meliBrand);

    return brands.filter((b) => {
      const name = this.normalize(b.name);

      return (
        name === normalized ||
        name.includes(normalized) ||
        normalized.includes(name)
      );
    });
  }
}
