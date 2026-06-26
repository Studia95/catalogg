import { defaultCatalogSections, type TemplateMetadata } from '../../shared/types';

export const metadata: TemplateMetadata = {
  key: 'restaurant-modern',
  version: 1,
  name: 'Restaurant Modern',
  businessTypes: ['restaurant', 'cafe'],
  description: 'Initial restaurant and cafe catalog template.',
  sections: defaultCatalogSections,
  immutable: true
};
