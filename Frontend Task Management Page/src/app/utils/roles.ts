export type UserRole = 'admin' | 'supervisor' | 'subcontractor';

export interface RolePermissions {
  canViewAllTasks: boolean;
  canAddTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canExport: boolean;
  canManageProjects: boolean;
  canManageContractors: boolean;
  canViewDashboard: boolean;
  canViewOfficeView: boolean;
  canViewSupervisorView: boolean;
  canViewSubcontractorView: boolean;
}

const ROLE_PATHS: Record<string, UserRole> = {
  'a7f3b2c1': 'admin',
  's9k4m8p2': 'supervisor',
  'w5x2n6q1': 'subcontractor',
};

const ROLE_TO_PATH: Record<UserRole, string> = {
  'admin': 'a7f3b2c1',
  'supervisor': 's9k4m8p2',
  'subcontractor': 'w5x2n6q1',
};

export function getRoleFromUrl(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/^\//, '').split('/')[0];
  return ROLE_PATHS[path] || null;
}

export function getRolePath(role: UserRole): string {
  return ROLE_TO_PATH[role];
}

export function getAllRoleUrls(): Array<{ role: UserRole; path: string; url: string }> {
  if (typeof window === 'undefined') return [];
  const baseUrl = window.location.origin;
  return Object.entries(ROLE_TO_PATH).map(([role, path]) => ({
    role: role as UserRole,
    path,
    url: `${baseUrl}/${path}`,
  }));
}

export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case 'admin':
      return {
        canViewAllTasks: true,
        canAddTasks: true,
        canEditTasks: true,
        canDeleteTasks: true,
        canExport: true,
        canManageProjects: true,
        canManageContractors: true,
        canViewDashboard: true,
        canViewOfficeView: true,
        canViewSupervisorView: true,
        canViewSubcontractorView: true,
      };
    case 'supervisor':
      return {
        canViewAllTasks: true,
        canAddTasks: true,
        canEditTasks: true,
        canDeleteTasks: false,
        canExport: true,
        canManageProjects: false,
        canManageContractors: false,
        canViewDashboard: true,
        canViewOfficeView: false,
        canViewSupervisorView: true,
        canViewSubcontractorView: false,
      };
    case 'subcontractor':
      return {
        canViewAllTasks: false,
        canAddTasks: false,
        canEditTasks: true,
        canDeleteTasks: false,
        canExport: false,
        canManageProjects: false,
        canManageContractors: false,
        canViewDashboard: false,
        canViewOfficeView: false,
        canViewSupervisorView: false,
        canViewSubcontractorView: true,
      };
    default:
      return {
        canViewAllTasks: false,
        canAddTasks: false,
        canEditTasks: false,
        canDeleteTasks: false,
        canExport: false,
        canManageProjects: false,
        canManageContractors: false,
        canViewDashboard: false,
        canViewOfficeView: false,
        canViewSupervisorView: false,
        canViewSubcontractorView: false,
      };
  }
}
