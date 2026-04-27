export type StorageMode = 'local' | 'supabase';

export const STORAGE_KEY = 'buildops_pro_data';

export const getStorageMode = (): StorageMode => {
  const configured = import.meta.env.VITE_STORAGE_MODE;
  if (configured === 'supabase') return 'supabase';
  if (configured === 'local') return 'local';
  return 'local';
};

