export type CatalogAdminAccessInput = {
  isLegacyCatalogSlug: boolean;
  hasPlatformClientAccess: boolean;
  hasLegacyAdminAccess: boolean;
};

export const catalogAccessAllowsAdmin = ({
  isLegacyCatalogSlug,
  hasPlatformClientAccess,
  hasLegacyAdminAccess
}: CatalogAdminAccessInput) => hasPlatformClientAccess || (isLegacyCatalogSlug && hasLegacyAdminAccess);
