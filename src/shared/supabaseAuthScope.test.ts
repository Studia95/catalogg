import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getSupabaseAuthFallbackStorageKeys,
  getSupabaseAuthScope,
  getSupabaseAuthStorageKeyForRedirect
} from './supabaseAuthScope';

describe('Supabase auth scopes', () => {
  it('keeps driver, restaurant and platform admin sessions independent', () => {
    assert.equal(getSupabaseAuthScope('#/driver/orders'), 'driver');
    assert.equal(getSupabaseAuthScope('#/mangal/settings'), 'restaurant-admin');
    assert.equal(getSupabaseAuthScope('/rizih/dashboard'), 'restaurant-admin');
    assert.equal(getSupabaseAuthScope('#/admin/subscriptions'), 'platform-admin');
  });

  it('keeps public client and generic login sessions separate from role apps', () => {
    assert.equal(getSupabaseAuthScope('#/profile/orders'), 'client');
    assert.equal(getSupabaseAuthScope('#/mangal'), 'client');
    assert.equal(getSupabaseAuthScope('#/login'), 'login');
    assert.equal(getSupabaseAuthStorageKeyForRedirect('/driver'), 'waycatalog-auth-driver');
  });

  it('can recover a missing scoped session from other known Supabase session keys', () => {
    assert.deepEqual(getSupabaseAuthFallbackStorageKeys('driver'), [
      'waycatalog-auth-driver',
      'waycatalog-auth-login',
      'waycatalog-auth-restaurant-admin',
      'waycatalog-auth-platform-admin',
      'waycatalog-auth-client',
      'waycatalog-auth'
    ]);
  });
});
