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
    console.log('--------------------------------');
    console.log(`OpenAI MATCH START`);
    console.log(`ML Category: ${product.meliCategoryPath}`);

    // filtramos categorías por root
    const root = product.meliCategoryPath?.split(' > ')[0]?.toLowerCase();

    const filteredCategories = categories.filter((c) =>
      c.path?.toLowerCase().includes(root),
    );

    const categoriesForPrompt =
      filteredCategories.length > 0 ? filteredCategories : categories;

    console.log(`Root detected: ${root}`);
    console.log(`Fravega categories sent: ${categoriesForPrompt.length}`);

    const start = Date.now();

    return this.retry(async () => {
      console.log(`Calling OpenAI...`);

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
Categoria MercadoLibre:
${product.meliCategoryPath}

Categorias disponibles en Fravega:
${JSON.stringify(categoriesForPrompt)}

Selecciona la mejor coincidencia.

Responde SOLO con JSON:

{
 "categoryId": "",
 "categoryName": "",
 "categoryPath": ""
}
`,
          },
        ],
      });

      const duration = Date.now() - start;

      console.log(`OpenAI response received (${duration} ms)`);

      const content = completion.choices[0].message.content;

      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      const parsed = JSON.parse(content) as CategoryMatchResult;

      console.log(`Matched Fravega category: ${parsed.categoryPath}`);
      console.log('--------------------------------');

      return parsed;
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

      console.warn(`OpenAI retry... remaining attempts: ${retries}`);

      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retry(fn, retries - 1, delay * 2);
    }
  }
}
