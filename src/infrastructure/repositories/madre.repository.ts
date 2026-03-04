import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IMadreRepository } from 'src/domains/interface/madre.repository.interface';
import { Product } from 'src/domains/entities/product.entity';

@Injectable()
export class MadreRepository implements IMadreRepository {
  constructor(private readonly http: HttpService) {}

  async getProducts(offset: number, limit: number): Promise<Product[]> {
    const url = `https://api.madre.loquieroaca.com/api/products/madre?offset=${offset}&limit=${limit}`;

    const response = await firstValueFrom(
      this.http.get(url, {
        headers: { accept: '*/*' },
      }),
    );

    const products = response.data.items;

    return products.map(
      (p: any) =>
        new Product({
          sku: p.sku,
          title: p.title,
          description: p.description,
        }),
    );
  }
}
