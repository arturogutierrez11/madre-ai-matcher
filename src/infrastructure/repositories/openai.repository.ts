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
    fravegaBrands: { id: string; name: string }[],
  ): Promise<{
    fravegaBrandId: string | null;
    fravegaBrandName: string | null;
    confidence: number;
  }> {
    console.log('--------------------------------');
    console.log(`OpenAI BRAND MATCH START`);
    console.log(`ML Brand: ${meliBrand}`);

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
            content: `
Sos un especialista en normalización y matching de marcas de ecommerce.

Tu objetivo es encontrar la marca de Fravega que corresponda EXACTAMENTE
a la marca de MercadoLibre.

Reglas estrictas:

1. Solo seleccionar una marca si estás seguro que representan la MISMA empresa o marca.
2. No seleccionar marcas que sean solo similares o parcialmente coincidentes.
3. No confundir líneas de producto, modelos o colecciones con marcas.
4. Ignorar diferencias menores como:
   - mayúsculas/minúsculas
   - espacios
   - símbolos
   - "Inc", "Corp", "Co", "Ltd"
5. Si no existe una coincidencia clara, devolver null.
6. Nunca inventar marcas que no estén en la lista.

El confidence debe reflejar la certeza real del match:

1.0 → exactamente la misma marca  
0.9 → misma marca con pequeñas variaciones  
0.7 → probable pero no totalmente seguro  
<0.6 → no es match confiable (usar null)
`,
          },
          {
            role: 'user',
            content: `
Marca de MercadoLibre:
"${meliBrand}"

Lista de marcas disponibles en Fravega:
${JSON.stringify(fravegaBrands)}

Selecciona la mejor coincidencia SOLO si es claramente la misma marca.

Responde SOLO con JSON:

{
 "fravegaBrandId": string | null,
 "fravegaBrandName": string | null,
 "confidence": number
}

Si no hay coincidencia clara:

{
 "fravegaBrandId": null,
 "fravegaBrandName": null,
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

      const parsed = JSON.parse(content);

      console.log(`Matched Fravega brand: ${parsed.fravegaBrandName}`);
      console.log(`Confidence: ${parsed.confidence}`);
      console.log('--------------------------------');

      return parsed;
    });
  }
}
