import { defaultCatalogSections, type TemplateMetadata } from '../../shared/types';

export const metadata: TemplateMetadata = {
  key: 'barbershop-dark',
  version: 1,
  name: 'Barbershop Dark',
  businessTypes: ['barbershop', 'salon', 'service'],
  description: 'Dark service catalog template for barbershops and salons.',
  sections: defaultCatalogSections,
  immutable: true
};
