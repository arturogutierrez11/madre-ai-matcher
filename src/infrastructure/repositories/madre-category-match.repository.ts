// import { Injectable } from '@nestjs/common';
// import { HttpService } from '@nestjs/axios';
// import { ConfigService } from '@nestjs/config';
// import { firstValueFrom } from 'rxjs';
// import { IMadreCategoryMatchRepository } from 'src/domains/interface/madre-category-match.repository.interface';
//
// @Injectable()
// export class MadreCategoryMatchRepository implements IMadreCategoryMatchRepository {
//   constructor(
//     private readonly http: HttpService,
//     private readonly config: ConfigService,
//   ) {}
//
//   private get baseUrl() {
//     return this.config.get<string>('MADRE_API');
//   }
//
//   async getAll(page = 1, limit = 50): Promise<any[]> {
//     const url = `${this.baseUrl}/categories/meli/match?page=${page}&limit=${limit}`;
//
//     const response = await firstValueFrom(
//       this.http.get(url, { headers: { accept: '*/*' } }),
//     );
//
//     return response.data;
//   }
//
//   async findByMeliCategoryId(meliCategoryId: string): Promise<any | null> {
//     const url = `${this.baseUrl}/categories/meli/match/${meliCategoryId}`;
//
//     const response = await firstValueFrom(
//       this.http.get(url, { headers: { accept: '*/*' } }),
//     );
//
//     return response.data ?? null;
//   }
//
//   async exists(meliCategoryId: string): Promise<boolean> {
//     const url = `${this.baseUrl}/categories/meli/match/exists/${meliCategoryId}`;
//
//     const response = await firstValueFrom(
//       this.http.get(url, { headers: { accept: '*/*' } }),
//     );
//
//     return response.data.exists;
//   }
//
//   async save(match: {
//     meliCategoryId: string;
//     meliCategoryPath: string;
//     fravegaCategoryId: string;
//     fravegaCategoryPath: string;
//   }): Promise<void> {
//     const url = `${this.baseUrl}/categories/meli/match`;
//
//     await firstValueFrom(
//       this.http.post(url, match, {
//         headers: {
//           'Content-Type': 'application/json',
//           accept: '*/*',
//         },
//       }),
//     );
//   }
//
//   async saveBulk(
//     matches: {
//       meliCategoryId: string;
//       meliCategoryPath: string;
//       fravegaCategoryId: string;
//       fravegaCategoryPath: string;
//     }[],
//   ): Promise<void> {
//     const url = `${this.baseUrl}/categories/meli/match/bulk`;
//
//     await firstValueFrom(
//       this.http.post(url, matches, {
//         headers: {
//           'Content-Type': 'application/json',
//           accept: '*/*',
//         },
//       }),
//     );
//   }
// }
