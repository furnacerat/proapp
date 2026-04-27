import type { MaterialOrder } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const ordersService = createCollectionService<MaterialOrder>('materialOrders', TABLES.materialOrders);

