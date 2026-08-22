// ============================================================
//  permission-dependencies.ts  –  Cross-module "auxiliary list"
//  dependencies for permission keys.
//
//  Several screens populate filter dropdowns / reference data by
//  calling OTHER modules' own list endpoints (e.g. the Batch list
//  screen's Program/Center filters call ims/program/list and
//  ims/center/list, each gated server-side by orgProgram:list /
//  orgCenter:list). A user granted only the primary action key
//  (e.g. batch:promote) but not those auxiliary keys will have
//  that action silently break — the dropdown/lookup 403s even
//  though the button itself is visible.
//
//  This map lets the Users screen's permission picker auto-check
//  those auxiliary keys whenever a primary key is checked, so
//  admins don't have to know this wiring by heart.
//
//  Unchecking a primary key does NOT auto-remove its dependencies
//  (they may be required by something else already granted).
// ============================================================

export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // ---------------- Batch ----------------
  'batch:list': ['orgProgram:list', 'orgCenter:list'],
  'batch:view': ['orgProgram:list', 'orgCenter:list'],
  'batch:edit': ['orgProgram:list', 'orgCenter:list'],
  'batch:promote': ['orgProgram:list'],
  'batch:addSpecialClass': ['orgStaff:list'],
  'batch:assignFaculty': ['orgStaff:list'],

  // ---------------- Timetable / Attendance ----------------
  'timetable:list': ['batch:list'],
  'timetable:view': ['batch:list'],
  'timetable:edit': ['batch:list', 'orgStaff:list'],
  'attendance:list': ['batch:list'],
  'attendance:mark': ['batch:list'],

  // ---------------- Org Masters ----------------
  'orgStaff:create': ['orgCenter:list', 'orgDept:list', 'orgSubject:list'],
  'orgStaff:edit': ['orgCenter:list', 'orgDept:list', 'orgSubject:list'],
  'orgProgram:create': ['orgSubject:list'],
  'orgProgram:edit': ['orgSubject:list'],
  'orgProgram:addSubjects': ['orgSubject:list'],
  'orgProgram:removeSubjects': ['orgSubject:list'],
  'orgProgram:examMapping': ['orgSubject:list', 'orgExamCategory:list'],
  'orgTopic:create': ['orgSubject:list'],
  'orgTopic:edit': ['orgSubject:list'],
  'orgSubTopic:create': ['orgSubject:list', 'orgTopic:list'],
  'orgSubTopic:edit': ['orgSubject:list', 'orgTopic:list'],
  'orgExamCategory:addSubCategories': ['orgExamCategory:list'],
  'orgUser:create': ['orgCenter:list'],
  'orgUser:edit': ['orgCenter:list'],

  // ---------------- Student ----------------
  'student:list': ['orgProgram:list', 'orgCenter:list'],
  'student:view': ['orgProgram:list', 'orgCenter:list'],

  // ---------------- Admission ----------------
  'admission:list': ['orgProgram:list', 'orgCenter:list'],
  'admission:view': ['orgProgram:list', 'orgCenter:list'],
  'admission:create': ['orgProgram:list', 'orgCenter:list', 'orgFeePlan:list'],
  'admission:update': ['orgProgram:list', 'orgCenter:list', 'orgFeePlan:list'],
  'admission:approve': ['admission:view'],
  'admission:reject': ['admission:view'],
  'admission:review': ['admission:view'],

  // ---------------- Accounts ----------------
  'accounts:addPayment': ['student:list'],
  'accounts:listPayments': ['orgCenter:list', 'orgProgram:list'],
};

/** Resolves the full transitive closure of dependencies for a set of checked keys. */
export function resolveDependencies(keys: string[]): Set<string> {
  const resolved = new Set<string>();
  const stack = [...keys];
  while (stack.length) {
    const key = stack.pop();
    if (!key) continue;
    const deps = PERMISSION_DEPENDENCIES[key];
    if (!deps) continue;
    for (const dep of deps) {
      if (!resolved.has(dep)) {
        resolved.add(dep);
        stack.push(dep);
      }
    }
  }
  return resolved;
}
