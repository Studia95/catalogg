import { defaultCatalogSections, type TemplateMetadata } from '../../shared/types';

export const metadata: TemplateMetadata = {
  key: 'restaurant-modern',
  version: 2,
  name: 'Restaurant Modern',
  businessTypes: ['restaurant', 'cafe'],
  description: 'Second restaurant template version for new catalogs and opt-in migrations.',
  sections: defaultCatalogSections,
  immutable: true
};
