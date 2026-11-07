export interface ExistingBootstrapAdmin {
  isActive: boolean
  emailVerified: boolean
  displayName: string
  roleKeys: string[]
}

export interface BootstrapState {
  organizationCount: number
  organizationName?: string
  expectedOrganizationName: string
  admin?: ExistingBootstrapAdmin
  expectedDisplayName: string
}

export function isBootstrapComplete(state: BootstrapState): boolean {
  return (
    state.organizationCount === 1 &&
    state.organizationName === state.expectedOrganizationName &&
    state.admin?.isActive === true &&
    state.admin.emailVerified &&
    state.admin.displayName === state.expectedDisplayName &&
    state.admin.roleKeys.includes('super_admin')
  )
}
