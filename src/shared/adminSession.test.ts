import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogAccessAllowsAdmin } from './adminSession';

describe('catalog admin session access', () => {
  it('keeps a restaurant session when a platform client owns the catalog even for the mangal slug', () => {
    assert.equal(
      catalogAccessAllowsAdmin({
        isLegacyCatalogSlug: true,
        hasPlatformClientAccess: true,
        hasLegacyAdminAccess: false
      }),
      true
    );
  });

  it('keeps the legacy admin fallback for local demo catalogs', () => {
    assert.equal(
      catalogAccessAllowsAdmin({
        isLegacyCatalogSlug: true,
        hasPlatformClientAccess: false,
        hasLegacyAdminAccess: true
      }),
      true
    );
  });

  it('rejects non-owners when neither access path matches', () => {
    assert.equal(
      catalogAccessAllowsAdmin({
        isLegacyCatalogSlug: false,
        hasPlatformClientAccess: false,
        hasLegacyAdminAccess: true
      }),
      false
    );
  });
});
