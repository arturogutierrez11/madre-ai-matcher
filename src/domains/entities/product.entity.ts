export class Product {
  sku: string;
  title: string;
  description: string;

  constructor(props: { sku: string; title: string; description: string }) {
    this.sku = props.sku;
    this.title = props.title;
    this.description = props.description;
  }
}
