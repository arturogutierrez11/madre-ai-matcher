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

  async matchBrand(
    meliBrand: string,
    brands: { id: string; name: string }[],
  ): Promise<{
    brandId: string | null;
    brandName: string | null;
    confidence: number;
  }> {
    console.log('--------------------------------');
    console.log(`OpenAI BRAND MATCH START`);
    console.log(`ML Brand: ${meliBrand}`);

    const start = Date.now();

    return this.retry(async () => {
      console.log(`Calling OpenAI...`);

      /** 🔥 Limitar cantidad para ahorrar tokens */
      const limitedBrands = brands.slice(0, 20);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },

        messages: [
          {
            role: 'system',
            content: `
Sos un especialista en normalización y matching de marcas de ecommerce.

Tu objetivo es encontrar la marca del marketplace que corresponda EXACTAMENTE
a la marca de MercadoLibre.

Reglas estrictas:

1. Solo seleccionar una marca si estás seguro que representan la MISMA marca.
2. No seleccionar marcas similares o parciales.
3. No confundir modelos, líneas o productos con marcas.
4. Ignorar diferencias menores:
   - mayúsculas/minúsculas
   - espacios
   - símbolos
   - sufijos como Inc, Corp, Ltd, etc.
5. Si no hay coincidencia clara, devolver null.
6. Nunca inventar marcas.

Confidence:
1.0 → match exacto  
0.9 → misma marca con variaciones  
0.7 → probable  
<0.6 → no confiable (usar null)
`,
          },
          {
            role: 'user',
            content: `
Marca de MercadoLibre:
"${meliBrand}"

Lista de marcas disponibles:
${JSON.stringify(limitedBrands)}

Seleccioná la mejor coincidencia.

Respondé SOLO JSON:

{
 "brandId": string | null,
 "brandName": string | null,
 "confidence": number
}

Si no hay match:

{
 "brandId": null,
 "brandName": null,
 "confidence": 0
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

      console.log('OpenAI RAW:', content);

      let parsed: any;

      try {
        parsed = JSON.parse(content);
      } catch (error) {
        console.error('Error parsing OpenAI response:', content);
        throw error;
      }

      /** 🔥 Validación fuerte (evita basura) */
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (!parsed.brandId && parsed.confidence > 0)
      ) {
        return {
          brandId: null,
          brandName: null,
          confidence: 0,
        };
      }

      console.log(`Matched brand: ${parsed.brandName}`);
      console.log(`Confidence: ${parsed.confidence}`);
      console.log('--------------------------------');

      return {
        brandId: parsed.brandId ?? null,
        brandName: parsed.brandName ?? null,
        confidence: parsed.confidence ?? 0,
      };
    });
  }
}
