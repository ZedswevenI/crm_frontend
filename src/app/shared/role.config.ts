// ============================================================
//  role.config.ts  –  Single source of truth for access control
//  Role levels come from login response: response.data.roleLevel
// ============================================================

export type RoleLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

export const ROLE_LABELS: Record<RoleLevel, string> = {
  L1: 'Super Admin',
  L2: 'Admissions',
  L3: 'AO',
  L4: 'Teacher',
  L5: 'Exam',
  L6: 'Account',
  L7: 'EDP',
};

export const ROUTE_ACCESS: Record<string, RoleLevel[]> = {
  dashboard:        ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
  batch:            ['L1', 'L2', 'L3'],
  timetable:        ['L1', 'L3', 'L4'],
  attendance:       ['L1', 'L3', 'L4'],
  assignment:       ['L1', 'L3', 'L7'],
  enableassignment: ['L1', 'L3', 'L4'],
  report:           ['L1', 'L5'],
  teacher:          ['L1', 'L6'],
  student:          ['L1', 'L2', 'L3'],
  communication:    ['L1', 'L2', 'L3'],
  chat:             ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
  activity:         ['L1', 'L3', 'L4'],
  feedback:         ['L1', 'L3', 'L4'],
  performance:      ['L1', 'L3', 'L4'],
  ptm:              ['L1', 'L3', 'L4'],
  task:             ['L1', 'L2', 'L3', 'L4'],
  circular:         ['L1', 'L2', 'L3'],
  phase:            ['L1', 'L3', 'L4'],
  knowledge:        ['L1', 'L3', 'L4'],
  support:          ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
  package:          ['L1', 'L2'],
  'org-master':     ['L1'],
  class:            ['L1', 'L3'],
  inward:           ['L1'],
  'exam-schedule':  ['L1', 'L5', 'L7'],
  exams:            ['L1', 'L5'],
};

// Which roles can DOWNLOAD in each module (L1 can always download)
export const DOWNLOAD_ACCESS: Record<string, RoleLevel[]> = {
  default:     ['L1'],
  report:      ['L1', 'L5'], // L5 can print (not download), handled in component
};

// Which roles require L1 approval before edits are saved
export const APPROVAL_REQUIRED: RoleLevel[] = ['L2', 'L6'];

// Helper: check if a role can access a route
export function canAccessRoute(role: RoleLevel, routePath: string): boolean {
  const allowed = ROUTE_ACCESS[routePath];
  if (!allowed) return role === 'L1'; // unknown routes: L1 only
  return allowed.includes(role);
}

// Helper: check if a role can download
export function canDownload(role: RoleLevel, module = 'default'): boolean {
  const allowed = DOWNLOAD_ACCESS[module] ?? DOWNLOAD_ACCESS['default'];
  return allowed.includes(role);
}

// Helper: check if role needs approval for edits
export function requiresApproval(role: RoleLevel): boolean {
  return APPROVAL_REQUIRED.includes(role);
}
