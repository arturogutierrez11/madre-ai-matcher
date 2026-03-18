import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IMeliCategoriesRepository } from 'src/domains/interface/meli-categories.repository.interface';
import { categoriesCache } from '../cache/categories.cache';

@Injectable()
export class MeliCategoriesRepository implements IMeliCategoriesRepository {
  constructor(private readonly http: HttpService) {}

  private loaded = 0;
  private startTime = 0;

  async getCategoriesTree(): Promise<any[]> {
    const cached = categoriesCache.get<any[]>('meli_categories');

    if (cached) {
      console.log('Using cached ML categories');
      return cached;
    }

    console.log('==============================');
    console.log('Loading MercadoLibre categories tree');
    console.log('==============================');

    this.startTime = Date.now();
    this.loaded = 0;

    const rootsResponse = await firstValueFrom(
      this.http.get('https://api.meli.loquieroaca.com/meli/categories'),
    );

    const roots = rootsResponse.data;

    const allCategories: any[] = [];

    for (const root of roots) {
      await this.traverseCategory(root.id, [], allCategories);
    }

    categoriesCache.set('meli_categories', allCategories); // 👈 CLAVE

    return allCategories;
  }

  async traverseCategory(id: string, parentPath: string[], result: any[]) {
    const response = await firstValueFrom(
      this.http.get(`https://api.meli.loquieroaca.com/meli/categories/${id}`),
    );

    const category = response.data;

    const currentPath = [...parentPath, category.name];

    result.push({
      id: category.id,
      name: category.name,
      path: currentPath.join(' > '),
    });

    this.loaded++;

    // progreso cada 50 categorías
    if (this.loaded % 50 === 0) {
      const elapsed = (Date.now() - this.startTime) / 1000;

      const rate = this.loaded / elapsed;

      console.log(
        `[ML TREE] Loaded ${this.loaded} categories | Speed: ${rate.toFixed(
          2,
        )} categories/sec`,
      );
    }

    if (category.children && category.children.length) {
      for (const child of category.children) {
        await this.traverseCategory(child.id, currentPath, result);
      }
    }
  }
}
