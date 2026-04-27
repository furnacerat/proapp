import type { ShoppingList } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const shoppingListsService = createCollectionService<ShoppingList>('shoppingLists', TABLES.shoppingLists);

