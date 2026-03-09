import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IMeliCategoriesRepository } from 'src/domains/interface/meli-categories.repository.interface';

@Injectable()
export class MeliCategoriesRepository implements IMeliCategoriesRepository {
  constructor(private readonly http: HttpService) {}

  private loaded = 0;
  private startTime = 0;

  async getCategoriesTree(): Promise<any[]> {
    console.log('==============================');
    console.log('Loading MercadoLibre categories tree');
    console.log('==============================');

    this.startTime = Date.now();
    this.loaded = 0;

    const rootsResponse = await firstValueFrom(
      this.http.get('https://api.meli.loquieroaca.com/meli/categories'),
    );

    const roots = rootsResponse.data;

    console.log(`Root categories found: ${roots.length}`);
    console.log('--------------------------------');

    const allCategories: any[] = [];

    let rootIndex = 0;

    for (const root of roots) {
      rootIndex++;

      console.log(
        `Processing root ${rootIndex}/${roots.length} → ${root.name} (${root.id})`,
      );

      await this.traverseCategory(root.id, [], allCategories);
    }

    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('--------------------------------');
    console.log(`Total ML categories loaded: ${this.loaded}`);
    console.log(`Total time: ${totalTime}s`);
    console.log('==============================');

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
