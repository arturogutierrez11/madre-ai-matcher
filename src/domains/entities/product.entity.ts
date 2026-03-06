export class Product {
  sku: string;
  title: string;
  meliCategoryPath: string;

  constructor(data: Partial<Product>) {
    Object.assign(this, data);
  }
}
