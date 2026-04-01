import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FravegaImagesSyncController } from './fravega-images-sync.controller';
import { SyncFravegaProductImagesUseCase } from 'src/application/use-case/sync-fravega-product-images.usecase';
import { FravegaPublishedProductsRepository } from 'src/infrastructure/repositories/fravega-published-products.repository';
import { MadreProductsRepository } from 'src/infrastructure/repositories/madre-products.repository';
import { FravegaImagesRepository } from 'src/infrastructure/repositories/fravega-images.repository';
import { ProductImagesRepository } from 'src/infrastructure/repositories/product-images.repository';
import { ImageProcessorService } from 'src/infrastructure/services/image-processor.service';
import { SpacesService } from 'src/infrastructure/services/spaces.service';
import { FravegaImagesSyncConfigService } from 'src/infrastructure/services/fravega-images-sync-config.service';

@Module({
  imports: [HttpModule],
  controllers: [FravegaImagesSyncController],
  providers: [
    SyncFravegaProductImagesUseCase,
    FravegaPublishedProductsRepository,
    MadreProductsRepository,
    FravegaImagesRepository,
    ProductImagesRepository,
    ImageProcessorService,
    SpacesService,
    FravegaImagesSyncConfigService,
    {
      provide: 'IProductImagesRepository',
      useClass: ProductImagesRepository,
    },
  ],
})
export class FravegaImagesSyncModule {}
