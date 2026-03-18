import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { ICategoriesRepository } from 'src/domains/interface/categories.repository.interface';
import { categoriesCache } from 'src/infrastructure/cache/categories.cache';

type MegatoneCategoryResponse = {
  total: number;
  categories: {
    codigo: number;
    descripcion: string;
  }[];
};

type NormalizedCategory = {
  id: string;
  name: string;
  path: string;
};

@Injectable()
export class MegatoneCategoriesRepository implements ICategoriesRepository {
  constructor(private readonly http: HttpService) {}

  async getCategoriesTree(): Promise<NormalizedCategory[]> {
    const cached = categoriesCache.get<NormalizedCategory[]>(
      'megatone_categories',
    );

    if (cached) {
      return cached;
    }

    const response = await firstValueFrom(
      this.http.get<MegatoneCategoryResponse>(
        'https://api.marketplace.loquieroaca.com/megatone/categories/all',
        {
          headers: { accept: '*/*' },
        },
      ),
    );

    const data = response.data.categories;

    const normalized: NormalizedCategory[] = data.map((c) => ({
      id: String(c.codigo),
      name: c.descripcion,
      path: c.descripcion, // 👈 importante para OpenAI
    }));

    categoriesCache.set('megatone_categories', normalized);

    return normalized;
  }
}
