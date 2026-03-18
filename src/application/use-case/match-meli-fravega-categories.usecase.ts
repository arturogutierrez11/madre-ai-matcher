// import { Inject, Injectable } from '@nestjs/common';
// import cliProgress from 'cli-progress';
//
// import type { ICategoriesRepository } from 'src/domains/interface/categories.repository.interface';
// import type { IMadreCategoryMatchRepository } from 'src/domains/interface/madre-category-match.repository.interface';
// import type { IMeliCategoriesRepository } from 'src/domains/interface/meli-categories.repository.interface';
// import type { IOpenAIRepository } from 'src/domains/interface/openai.repository.interface';
//
// @Injectable()
// export class MatchMeliFravegaCategoriesUseCase {
//   constructor(
//     @Inject('IMeliCategoriesRepository')
//     private readonly meliCategoriesRepository: IMeliCategoriesRepository,
//
//     @Inject('ICategoriesRepository')
//     private readonly fravegaCategoriesRepository: ICategoriesRepository,
//
//     @Inject('IMadreCategoryMatchRepository')
//     private readonly madreRepository: IMadreCategoryMatchRepository,
//
//     @Inject('IOpenAIRepository')
//     private readonly openAIRepository: IOpenAIRepository,
//   ) {}
//
//   async execute() {
//     console.log('==============================');
//     console.log('Starting ML → Fravega matcher');
//     console.log('==============================');
//
//     const startTime = Date.now();
//
//     const meliCategories =
//       await this.meliCategoriesRepository.getCategoriesTree();
//
//     const fravegaCategories =
//       await this.fravegaCategoriesRepository.getCategoriesTree();
//
//     const total = meliCategories.length;
//
//     console.log(`ML categories loaded: ${total}`);
//     console.log(`Fravega categories loaded: ${fravegaCategories.length}`);
//     console.log('--------------------------------');
//
//     let processed = 0;
//     let skipped = 0;
//     let matched = 0;
//     let errors = 0;
//
//     const bar = new cliProgress.SingleBar(
//       {
//         format:
//           'Matching |{bar}| {percentage}% || {value}/{total} Categories || Matched:{matched} Skipped:{skipped} Errors:{errors}',
//       },
//       cliProgress.Presets.shades_classic,
//     );
//
//     bar.start(total, 0, {
//       matched: 0,
//       skipped: 0,
//       errors: 0,
//     });
//
//     for (const meliCategory of meliCategories) {
//       processed++;
//
//       try {
//         const exists = await this.madreRepository.exists(meliCategory.id);
//
//         if (exists) {
//           skipped++;
//
//           bar.update(processed, {
//             matched,
//             skipped,
//             errors,
//           });
//
//           continue;
//         }
//
//         const match = await this.openAIRepository.matchCategory(
//           {
//             title: meliCategory.name,
//             meliCategoryPath: meliCategory.path,
//           } as any,
//           fravegaCategories,
//         );
//
//         await this.madreRepository.save({
//           meliCategoryId: meliCategory.id,
//           meliCategoryPath: meliCategory.path,
//           fravegaCategoryId: match.categoryId,
//           fravegaCategoryPath: match.categoryPath,
//         });
//
//         matched++;
//
//         console.log(
//           `✔ MATCHED → ML: ${meliCategory.path} → FRAVEGA: ${match.categoryPath}`,
//         );
//       } catch (error) {
//         errors++;
//
//         console.error(`✖ ERROR → ${meliCategory.id} (${meliCategory.path})`);
//         console.error(error);
//       }
//
//       bar.update(processed, {
//         matched,
//         skipped,
//         errors,
//       });
//
//       // progreso extendido cada 20 categorías
//       if (processed % 20 === 0) {
//         const elapsed = (Date.now() - startTime) / 1000;
//
//         const rate = processed / elapsed;
//
//         const remaining = total - processed;
//
//         const eta = (remaining / rate).toFixed(0);
//
//         console.log('--------------------------------');
//         console.log(`Progress: ${processed}/${total}`);
//         console.log(`Matched: ${matched}`);
//         console.log(`Skipped: ${skipped}`);
//         console.log(`Errors: ${errors}`);
//         console.log(`Speed: ${rate.toFixed(2)} categories/sec`);
//         console.log(`ETA: ${eta} seconds`);
//         console.log('--------------------------------');
//       }
//     }
//
//     bar.stop();
//
//     const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//
//     console.log('==============================');
//     console.log('Matcher completed');
//     console.log('==============================');
//     console.log(`Total categories: ${total}`);
//     console.log(`Matched: ${matched}`);
//     console.log(`Skipped: ${skipped}`);
//     console.log(`Errors: ${errors}`);
//     console.log(`Total time: ${totalTime}s`);
//     console.log('==============================');
//   }
// }
