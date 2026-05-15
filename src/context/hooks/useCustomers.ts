import type { Dispatch, SetStateAction } from 'react';
import type { AppData, Customer } from '../../data/types';

interface CustomerHookDeps {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

export function useCustomers({ data, setData }: CustomerHookDeps) {
  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newCustomer: Customer = { ...customer, id, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    return id;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setData(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
    }));
  };

  const deleteCustomer = (id: string) => {
    setData(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== id) }));
  };

  const getCustomerById = (id: string) => data.customers.find(c => c.id === id);
  const getJobCustomer = (jobId: string) => {
    const job = data.jobs.find(j => j.id === jobId);
    return job ? data.customers.find(c => c.id === job.customerId) : undefined;
  };
  const getEstimateCustomer = (estimateId: string) => {
    const estimate = data.estimates.find(e => e.id === estimateId);
    return estimate ? data.customers.find(c => c.id === estimate.customerId) : undefined;
  };

  return {
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById,
    getJobCustomer,
    getEstimateCustomer,
  };
}
