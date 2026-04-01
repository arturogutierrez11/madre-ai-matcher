import { Inject, Injectable } from '@nestjs/common';
import cliProgress from 'cli-progress';

import type { IFravegaBrandsRepository } from 'src/domains/interface/brands/FravegaBrandsRepository.interface';
import type { IBrandMatchRepository } from 'src/domains/interface/brands/IBrandMatchRepository';
import type { IMeliBrandsRepository } from 'src/domains/interface/brands/IMeliBrandsRepository';
import type { IOpenAIRepository } from 'src/domains/interface/openai.repository.interface';

@Injectable()
export class MatchMeliFravegaBrandsUseCase {
  constructor(
    @Inject('IMeliBrandsRepository')
    private readonly meliBrandsRepository: IMeliBrandsRepository,

    @Inject('IFravegaBrandsRepository')
    private readonly fravegaBrandsRepository: IFravegaBrandsRepository,

    @Inject('IBrandMatchRepository')
    private readonly madreRepository: IBrandMatchRepository,

    @Inject('IOpenAIRepository')
    private readonly openAIRepository: IOpenAIRepository,
  ) {}

  async execute() {
    console.log('==============================');
    console.log('Starting ML → Fravega BRAND matcher');
    console.log('==============================');

    const startTime = Date.now();

    const fravegaBrands = await this.fravegaBrandsRepository.getBrands();

    console.log(`Fravega brands loaded: ${fravegaBrands.length}`);

    let page = 1;
    const limit = 100;

    let processed = 0;
    let skipped = 0;
    let matched = 0;
    let errors = 0;

    const bar = new cliProgress.SingleBar(
      {
        format:
          'Matching |{bar}| {value} Brands || Matched:{matched} Skipped:{skipped} Errors:{errors}',
      },
      cliProgress.Presets.shades_classic,
    );

    bar.start(1, 0, {
      matched: 0,
      skipped: 0,
      errors: 0,
    });

    while (true) {
      const meliBrands = await this.meliBrandsRepository.getBrands(page, limit);

      if (!meliBrands.length) break;

      for (const meliBrand of meliBrands) {
        processed++;

        try {
          /** 🧹 limpiar basura */
          if (!meliBrand || meliBrand.length < 2) {
            skipped++;
            continue;
          }

          const invalid = ['---', '...', '*', '0', '1'];

          if (invalid.includes(meliBrand.trim())) {
            skipped++;
            continue;
          }

          /** 🚫 evitar reprocesar */
          const exists =
            await this.madreRepository.existsByMeliBrand?.(meliBrand);

          if (exists) {
            skipped++;
            continue;
          }

          /** 🔎 buscar candidatos */
          const candidates = this.findCandidates(meliBrand, fravegaBrands);

          /** ⚡ match exacto */
          const exact = candidates.find(
            (c) => this.normalize(c.name) === this.normalize(meliBrand),
          );

          if (exact) {
            await this.madreRepository.saveMatch({
              meliBrand,
              fravegaBrandId: exact.id,
              fravegaBrandName: exact.name,
              confidence: 1,
            });

            matched++;

            console.log(
              `✔ EXACT MATCH → ML: ${meliBrand} → FRAVEGA: ${exact.name}`,
            );

            continue;
          }

          /** 🚫 sin candidatos */
          if (candidates.length === 0) {
            skipped++;
            continue;
          }

          /** 🎯 limitar candidatos */
          const limitedCandidates = candidates.slice(0, 20);

          /** 🤖 OpenAI */
          const match = await this.openAIRepository.matchBrand(
            meliBrand,
            limitedCandidates,
          );

          /** 🚫 validar resultado */
          if (!match.brandId || !match.brandName || match.confidence < 0.7) {
            skipped++;
            continue;
          }

          /** 💾 guardar */
          await this.madreRepository.saveMatch({
            meliBrand,
            fravegaBrandId: match.brandId,
            fravegaBrandName: match.brandName,
            confidence: match.confidence,
          });

          matched++;

          console.log(
            `✔ AI MATCH → ML: ${meliBrand} → FRAVEGA: ${match.brandName}`,
          );
        } catch (error) {
          errors++;

          console.error(`✖ ERROR → ${meliBrand}`);
          console.error(error);
        }

        bar.update(processed, {
          matched,
          skipped,
          errors,
        });

        /** 📊 progreso */
        if (processed % 20 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = processed / elapsed;

          console.log('--------------------------------');
          console.log(`Progress: ${processed}`);
          console.log(`Matched: ${matched}`);
          console.log(`Skipped: ${skipped}`);
          console.log(`Errors: ${errors}`);
          console.log(`Speed: ${rate.toFixed(2)} brands/sec`);
          console.log('--------------------------------');
        }
      }

      page++;
    }

    bar.stop();

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('==============================');
    console.log('Brand matcher completed');
    console.log('==============================');
    console.log(`Processed: ${processed}`);
    console.log(`Matched: ${matched}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total time: ${totalTime}s`);
    console.log('==============================');
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
