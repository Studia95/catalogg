import type { TemplateKey } from '../templates/shared/types';

export type CatalogRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type ProductStatus = 'draft' | 'active' | 'hidden' | 'sold_out' | 'archived';

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type BookingStatus = 'new' | 'confirmed' | 'completed' | 'cancelled';

export type CatalogVisibility = 'draft' | 'published' | 'archived';

export type TemplateVersionRef = {
  templateKey: TemplateKey;
  version: number;
  templateVersionId: string;
};

export type CatalogIdentity = {
  id: string;
  slug: string;
  name: string;
  visibility: CatalogVisibility;
  template: TemplateVersionRef;
};

export type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelected: number;
  maxSelected: number;
  options: ProductOption[];
};

export type CartLineOption = {
  groupId: string;
  optionId: string;
};

export type PublicOrderLine = {
  productId: string;
  quantity: number;
  options: CartLineOption[];
};

export type PublicOrderInput = {
  catalogId: string;
  customerName: string;
  customerPhone: string;
  comment?: string;
  tableLabel?: string;
  lines: PublicOrderLine[];
};
