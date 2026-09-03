export type Role = 'SUPER_ADMIN' | 'SALES_PERSON';

export interface User {
  id?: number;
  username: string;
  name: string;
  role: Role;
}

export interface UserDto {
  id?: number;
  username: string;
  name: string;
  role: Role;
}

export interface Category {
  id?: number;
  name: string;
}

export interface ProductDto {
  id: number;
  itemCode: string;
  name: string;
  description?: string;
  imageUrl?: string;
  standardPrice: number;
  minPrice: number;
  totalStock: number;
}

export interface CreateProductRequest {
  itemCode: string;
  name: string;
  description?: string;
  imageUrl?: string;
  standardPrice: number;
  minPrice: number;
}

export interface CustomerDto {
  id: number;
  name: string;
  mobile: string;
  createdAt: string;
  outstandingBalance: number;
  totalSpend: number;
}

export interface CreateCustomerRequest {
  name: string;
  mobile: string;
}

export interface ExpenseItemDto {
  description: string;
  amount: number;
}

export interface CreateStockBatchRequest {
  productId: number;
  quantity: number;
  baseCost: number;
  sellingPrice: number;
  expenses: ExpenseItemDto[];
  standardPrice: number;
  minPrice: number;
}

export interface StockBatchDto {
  id: number;
  productId: number;
  productName: string;
  quantityInitial: number;
  quantityRemaining: number;
  baseCost: number;
  sellingPrice: number;
  totalExpenses: number;
  costPerItem: number;
  createdAt: string;
}

export interface AddBatchExpenseRequest {
  batchId: number;
  description: string;
  amount: number;
}

export type DiscountLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'MAX';
export type SalePaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
export type DeliveryPaymentMethod = 'COD' | 'CASH_DEPOSIT';
export type OrderStatus = 'PENDING' | 'READY' | 'DELIVERED' | 'RETURNED';

export interface SaleItemRequest {
  productId: number;
  quantity: number;
  discountType: 'PERCENTAGE' | 'FIXED' | 'NONE';
  discountValue: number;
  overridePrice?: number;
}

export interface SaleRequest {
  customerId: number;
  items: SaleItemRequest[];
  discountLevel: DiscountLevel;
  customDiscountAmount?: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountReason?: string;
  isInternal?: boolean;
  internalReason?: string;
  paymentAmount?: number;
  paymentMethod?: string;
}

export interface SaleItemDto {
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;
  discountAmount: number;
  finalAmount: number;
}

export interface PaymentDto {
  id: number;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

export interface SaleDto {
  id: number;
  invoiceId: string;
  customerId: number;
  customerName: string;
  sellerName: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  discountLevel: DiscountLevel;
  discountReason?: string;
  isInternal: boolean;
  internalReason?: string;
  createdAt: string;
  items: SaleItemDto[];
  payments: PaymentDto[];
  outstandingBalance: number;
}

export interface PaymentRequest {
  saleId: number;
  amount: number;
  paymentMethod: SalePaymentMethod;
}

export interface DeliveryOrderItemRequest {
  productId: number;
  quantity: number;
}

export interface DeliveryOrderRequest {
  customerId?: number;  // Optional customer
  deliveryDetails?: string;  // Customer delivery details (name, address, mobile)
  paymentMethod: DeliveryPaymentMethod;
  codAmount: number;
  deliveryFee: number;
  items: DeliveryOrderItemRequest[];
}

export interface DeliveryOrderItemDto {
  productId: number;
  productName: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice?: number;
}

export interface DeliveryOrderDto {
  id: number;
  customerName?: string;
  customerMobile?: string;
  deliveryDetails?: string;
  address?: string;
  orderDate: string;
  status: OrderStatus;
  paymentMethod: string;
  codAmount: number;
  deliveryFee: number;
  items: DeliveryOrderItemDto[];
}

export interface MiscExpenseDto {
  id?: number;
  description: string;
  amount: number;
  expenseDate?: string;
  category: string;
  createdAt?: string;
}

export interface ProfitBreakdownDto {
  totalSales: number;
  totalCostOfSales: number;
  totalMiscExpenses: number;
  netProfit: number;
}
