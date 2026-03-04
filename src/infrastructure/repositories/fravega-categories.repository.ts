import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { categoriesCache } from '../cache/categories.cache';
import { ICategoriesRepository } from 'src/domains/interface/categories.repository.interface';

@Injectable()
export class FravegaCategoriesRepository implements ICategoriesRepository {
  constructor(private readonly http: HttpService) {}

  async getCategoriesTree(): Promise<any[]> {
    const cached = categoriesCache.get('fravega_categories') as any[];

    if (cached) {
      return cached;
    }

    const response = await firstValueFrom(
      this.http.get(
        'https://api.marketplace.loquieroaca.com/fravega/categoriesTree',
        {
          headers: { accept: '*/*' },
        },
      ),
    );

    const categories = response.data.categories;

    const categoriesWithPath = this.buildCategoryPaths(categories);

    categoriesCache.set('fravega_categories', categoriesWithPath);

    return categoriesWithPath;
  }

  private buildCategoryPaths(categories: any[]): any[] {
    const map = new Map<string, any>();

    categories.forEach((cat) => {
      map.set(cat.id, cat);
    });

    const buildPath = (cat: any): string => {
      const path = [cat.name];
      let parent = map.get(cat.parentId);

      while (parent) {
        path.unshift(parent.name);
        parent = map.get(parent.parentId);
      }

      return path.join(' > ');
    };

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      path: buildPath(cat),
    }));
  }
}
