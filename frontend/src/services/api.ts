import axios from 'axios';
import { 
  UserDto, 
  Category, 
  ProductDto, 
  CreateProductRequest,
  CustomerDto, 
  CreateCustomerRequest, 
  CreateStockBatchRequest, 
  StockBatchDto, 
  AddBatchExpenseRequest,
  SaleRequest, 
  SaleDto, 
  PaymentRequest,
  PaymentDto,
  DeliveryOrderRequest, 
  DeliveryOrderDto,
  MiscExpenseDto, 
  ProfitBreakdownDto,
  OrderStatus
} from '../types';

const API_BASE = '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject JWT token into all requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('dcore_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Automatically redirect to login on 403 / 401
client.interceptors.response.use((response) => response, (error) => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    // If not a login request itself, redirect to login
    if (!error.config.url.includes('/auth/login')) {
      localStorage.removeItem('dcore_token');
      localStorage.removeItem('dcore_user');
      window.dispatchEvent(new Event('auth_change'));
    }
  }
  return Promise.reject(error);
});

export const api = {
  // Auth
  auth: {
    login: async (data: any) => {
      const res = await client.post('/auth/login', data);
      return res.data; // returns { token: "...", tokenType: "Bearer" }
    },
  },

  // Users
  users: {
    getAll: async (): Promise<UserDto[]> => {
      const res = await client.get('/users');
      return res.data;
    },
    create: async (data: any): Promise<UserDto> => {
      const res = await client.post('/users', data);
      return res.data;
    },
  },

  // Categories
  categories: {
    getAll: async (): Promise<Category[]> => {
      const res = await client.get('/categories');
      return res.data;
    },
    create: async (data: Category): Promise<Category> => {
      const res = await client.post('/categories', data);
      return res.data;
    },
  },

  // Products
  products: {
    getAll: async (): Promise<ProductDto[]> => {
      const res = await client.get('/products');
      return res.data;
    },
    getById: async (id: number): Promise<ProductDto> => {
      const res = await client.get(`/products/${id}`);
      return res.data;
    },
    create: async (data: CreateProductRequest): Promise<ProductDto> => {
      const res = await client.post('/products', data);
      return res.data;
    },
    getNextCode: async (): Promise<string> => {
      const res = await client.get('/products/next-code');
      return res.data;
    },
    checkExists: async (name: string): Promise<boolean> => {
      const res = await client.get(`/products/exists`, { params: { name } });
      return res.data;
    },
  },

  // Customers
  customers: {
    getAll: async (): Promise<CustomerDto[]> => {
      const res = await client.get('/customers');
      return res.data;
    },
    create: async (data: CreateCustomerRequest): Promise<CustomerDto> => {
      const res = await client.post('/customers', data);
      return res.data;
    },
    searchMobile: async (mobile: string): Promise<CustomerDto> => {
      const res = await client.get('/customers/search', { params: { mobile } });
      return res.data;
    },
    getSalesHistory: async (id: number): Promise<SaleDto[]> => {
      const res = await client.get(`/customers/${id}/sales`);
      return res.data;
    },
  },

  // Batches
  batches: {
    getAll: async (): Promise<StockBatchDto[]> => {
      const res = await client.get('/batches');
      return res.data;
    },
    create: async (data: CreateStockBatchRequest): Promise<StockBatchDto> => {
      const res = await client.post('/batches', data);
      return res.data;
    },
    addExpense: async (data: AddBatchExpenseRequest): Promise<any> => {
      const res = await client.post('/batches/expenses', data);
      return res.data;
    },
    getProductDefaults: async (productId: number): Promise<any> => {
      const res = await client.get(`/batches/product/${productId}/latest`);
      return res.data;
    },
  },

  // Sales
  sales: {
    getAll: async (): Promise<SaleDto[]> => {
      const res = await client.get('/sales');
      return res.data;
    },
    getById: async (id: number): Promise<SaleDto> => {
      const res = await client.get(`/sales/${id}`);
      return res.data;
    },
    create: async (data: SaleRequest): Promise<SaleDto> => {
      const res = await client.post('/sales', data);
      return res.data;
    },
    addPayment: async (data: PaymentRequest): Promise<PaymentDto> => {
      const res = await client.post('/sales/payments', data);
      return res.data;
    },
  },

  // Delivery Orders
  deliveryOrders: {
    getAll: async (): Promise<DeliveryOrderDto[]> => {
      const res = await client.get('/delivery-orders');
      return res.data;
    },
    create: async (data: DeliveryOrderRequest): Promise<DeliveryOrderDto> => {
      const res = await client.post('/delivery-orders', data);
      return res.data;
    },
    updateStatus: async (id: number, status: OrderStatus): Promise<DeliveryOrderDto> => {
      const res = await client.patch(`/delivery-orders/${id}/status`, null, { params: { status } });
      return res.data;
    },
    autoComplete: async (): Promise<number> => {
      const res = await client.post('/delivery-orders/auto-complete');
      return res.data;
    },
  },

  // Misc Expenses
  miscExpenses: {
    getAll: async (): Promise<MiscExpenseDto[]> => {
      const res = await client.get('/misc-expenses');
      return res.data;
    },
    create: async (data: MiscExpenseDto): Promise<MiscExpenseDto> => {
      const res = await client.post('/misc-expenses', data);
      return res.data;
    },
    delete: async (id: number): Promise<void> => {
      await client.delete(`/misc-expenses/${id}`);
    },
  },

  // Uploads
  uploads: {
    uploadImage: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_BASE}/uploads/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('dcore_token')}`
        }
      });
      return res.data.url; // Returns the public image path e.g. "/uploads/UUID.jpg"
    }
  },

  // Reports (Admin only)
  reports: {
    getDailySales: async (dateStr: string): Promise<number> => {
      const res = await client.get('/reports/daily-sales', { params: { date: dateStr } });
      return res.data.sales;
    },
    getMonthlyProfit: async (year: number, month: number): Promise<ProfitBreakdownDto> => {
      const res = await client.get('/reports/monthly-profit', { params: { year, month } });
      return res.data;
    },
  },
};
