import { isBootstrapComplete } from './bootstrap-policy.js'

describe('isBootstrapComplete', () => {
  const initializedState = {
    organizationCount: 1,
    organizationName: 'Example Organization',
    expectedOrganizationName: 'Example Organization',
    admin: {
      isActive: true,
      emailVerified: true,
      displayName: 'Initial Administrator',
      roleKeys: ['super_admin'],
    },
    expectedDisplayName: 'Initial Administrator',
  }

  it('accepts a matching initialized organization and active Super Administrator', () => {
    expect(isBootstrapComplete(initializedState)).toBe(true)
  })

  it('rejects a partial, mismatched, or ambiguous bootstrap state', () => {
    expect(
      isBootstrapComplete({
        ...initializedState,
        admin: { ...initializedState.admin, roleKeys: [] },
      }),
    ).toBe(false)
    expect(
      isBootstrapComplete({
        ...initializedState,
        organizationName: 'A different organization',
      }),
    ).toBe(false)
    expect(
      isBootstrapComplete({ ...initializedState, organizationCount: 2 }),
    ).toBe(false)
  })
})
