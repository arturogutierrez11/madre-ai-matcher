import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import { Product } from 'src/domains/entities/product.entity';
import {
  CategoryMatchResult,
  IOpenAIRepository,
} from 'src/domains/interface/openai.repository.interface';

@Injectable()
export class OpenAIRepository implements IOpenAIRepository {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async matchCategory(
    product: Product,
    categories: any[],
  ): Promise<CategoryMatchResult> {
    return this.retry(async () => {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },

        messages: [
          {
            role: 'system',
            content:
              'Sos experto en categorización de productos para marketplaces.',
          },
          {
            role: 'user',
            content: `
Producto:
${product.title}

Categoria MercadoLibre:
${product.meliCategoryPath}

Categorias Fravega:
${JSON.stringify(categories)}

Responde con el JSON:

{
 "categoryId": "",
 "categoryName": "",
 "categoryPath": ""
}
`,
          },
        ],
      });

      const content = completion.choices[0].message.content;

      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      return JSON.parse(content) as CategoryMatchResult;
    });
  }

  private async retry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 2000,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) {
        console.error('OpenAI failed after retries:', error);
        throw error;
      }

      console.log(`OpenAI retry... remaining: ${retries}`);

      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retry(fn, retries - 1, delay * 2);
    }
  }
}
