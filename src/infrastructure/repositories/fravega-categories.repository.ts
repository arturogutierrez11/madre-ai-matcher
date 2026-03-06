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
        'https://api.madre.loquieroaca.com/api/categories/fravegaTree',
        {
          headers: { accept: '*/*' },
        },
      ),
    );

    const tree = response.data;

    const categoriesWithPath = this.flattenTree(tree);

    categoriesCache.set('fravega_categories', categoriesWithPath);

    return categoriesWithPath;
  }

  private flattenTree(tree: any[]): any[] {
    const result: any[] = [];

    const traverse = (nodes: any[], parentPath: string[] = []) => {
      for (const node of nodes) {
        const currentPath = [...parentPath, node.name];

        result.push({
          id: node.id,
          name: node.name,
          path: currentPath.join(' > '),
        });

        if (node.children && node.children.length) {
          traverse(node.children, currentPath);
        }
      }
    };

    traverse(tree);

    return result;
  }
}
