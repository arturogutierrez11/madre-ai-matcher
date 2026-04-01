export interface PersistedProductImage {
  sku: string;
  marketplace: 'fravega';
  originalUrl: string;
  cdnUrl: string;
  position: number;
  isMain: boolean;
  status: 'processed' | 'skipped' | 'failed';
}

export interface IProductImagesRepository {
  saveMany(images: PersistedProductImage[]): Promise<void>;
}
