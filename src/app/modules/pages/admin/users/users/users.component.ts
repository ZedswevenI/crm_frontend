import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

type RoleKey = 'L1' | 'L2' | 'L3' | 'L4';

interface RoleMeta {
  key: RoleKey;
  title: string;
  subtitle: string;
  permissions: string[];
}

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  userForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  roleInfoVisible = false;
  roleInfoKey: RoleKey | null = null;

  // Table columns
  columns = [
    { key: 'name',     label: 'User Name', sortable: true },
    { key: 'loginId',  label: 'Login ID',  sortable: true },
    { key: 'email',    label: 'Email',     sortable: true },
    { key: 'phone',    label: 'Phone',     sortable: false },
    { key: 'roleLabel',label: 'Role',      sortable: false },
    { key: 'isActive', label: 'Active',    sortable: false }
  ];

  // Dummy users
  users: any[] = [
    {
      id: 1,
      name: 'Academic Head',
      loginId: 'acad.head',
      email: 'academic.head@z7i.com',
      phone: '9000000001',
      role: 'L1',
      roleLabel: 'L1 - Academic Head',
      isActive: true
    },
    {
      id: 2,
      name: 'Admission Manager',
      loginId: 'adm.manager',
      email: 'admission.manager@z7i.com',
      phone: '9000000002',
      role: 'L2',
      roleLabel: 'L2 - Admission Manager',
      isActive: true
    },
    {
      id: 3,
      name: 'Accounts Manager',
      loginId: 'acc.manager',
      email: 'accounts.manager@z7i.com',
      phone: '9000000003',
      role: 'L3',
      roleLabel: 'L3 - Accounts Manager',
      isActive: true
    },
    {
      id: 4,
      name: 'Academic Operations',
      loginId: 'acad.ops',
      email: 'academic.ops@z7i.com',
      phone: '9000000004',
      role: 'L4',
      roleLabel: 'L4 - Academic Operations',
      isActive: true
    }
  ];

  // Actions: info icon + edit + delete
  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-circle-info',
      tooltip: 'Role permissions',
      color: '#6B7280',
      hoverColor: '#2563EB',
      callback: (row: any) => this.openRoleInfo(row.role as RoleKey)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: any) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row)
    }
  ];

  // Role dropdown options
  roleOptions = [
    { value: 'L1', label: 'L1 - Academic Head' },
    { value: 'L2', label: 'L2 - Admission Manager' },
    { value: 'L3', label: 'L3 - Accounts Manager' },
    { value: 'L4', label: 'L4 - Academic Operations' }
  ];

  // Centralised role meta with all permissions
  private roleMetaMap: Record<RoleKey, RoleMeta> = {
    L1: {
      key: 'L1',
      title: 'L1 - Academic Head',
      subtitle: 'Top-level access for academics and overall control.',
      permissions: [
        'Approval for admission',
        'All types of report generation',
        'Full read / write access to all academic and operational modules',
        'Can override and approve actions from other levels'
      ]
    },
    L2: {
      key: 'L2',
      title: 'L2 - Admission Manager',
      subtitle: 'End-to-end admissions & enrolment control.',
      permissions: [
        'New enrolment / admission entry',
        'Generate enrolment numbers for admitted students',
        'Name / Address / Phone number change for students',
        'Admission-related report generations',
        'Program-wise students list export',
        'Students Selected Not Joined report',
        'Hall ticket print',
        'View enrolment report',
        'All admission-related report generations'
      ]
    },
    L3: {
      key: 'L3',
      title: 'L3 - Accounts Manager',
      subtitle: 'Fee, cheque tracking and financial reporting.',
      permissions: [
        'View admission entries (no edit / new entry)',
        'Access to cheque details',
        'MIS report for upcoming cheque deposits (1st of every month)',
        'Mark deposited cheques as collected / dishonoured (with remarks)',
        'Add follow-up remarks for dishonoured cheques',
        'Handle replacement of dishonoured cheques',
        'Monthly / Quarterly / Yearly accounts report generation',
        'Blacklist / unblacklist defaulter students',
        'All accounts-related report generations'
      ]
    },
    L4: {
      key: 'L4',
      title: 'L4 - Academic Operations',
      subtitle: 'Operational control for classes, batches and attendance.',
      permissions: [
        'Timetable module management',
        'Batch association – map students to batches',
        'Manage batch details',
        'Faculty mapping to all batches',
        'Faculty entry and master management',
        'Faculty-wise / Batch-wise teaching hours report',
        'Student attendance report',
        'Attendance not-entered report',
        'Mail & WhatsApp communication triggers',
        'Identify students without contact number / email ID',
        'Student-wise attendance percentage reports',
        'Timetable rearrangements tracking',
        'Faculty feedback report export',
        'Schedule faculty feedback to students'
      ]
    }
  };

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Users & Roles' },
      { label: 'Users' }
    ]);
  }

  ngOnInit(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      loginId: ['', Validators.required],
      role: [null, Validators.required],
      isActive: [true]
    });
  }

  get currentRoleMeta(): RoleMeta | null {
    if (!this.roleInfoKey) return null;
    return this.roleMetaMap[this.roleInfoKey];
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.userForm.reset({
      name: '',
      email: '',
      phone: '',
      loginId: '',
      role: null,
      isActive: true
    });
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    this.userForm.reset({
      name: row.name,
      email: row.email,
      phone: row.phone,
      loginId: row.loginId,
      role: row.role,
      isActive: row.isActive
    });

    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const value = this.userForm.value;
    const roleOpt = this.roleOptions.find(r => r.value === value.role);
    const payload = {
      ...value,
      roleLabel: roleOpt?.label || value.role
    };

    if (this.formMode === 'create') {
      const newId = (this.users[this.users.length - 1]?.id || 0) + 1;
      this.users = [...this.users, { id: newId, ...payload }];
      this.alertService.success('User created successfully');
    } else if (this.editingId != null) {
      this.users = this.users.map(u =>
        u.id === this.editingId ? { ...u, ...payload } : u
      );
      this.alertService.success('User updated successfully');
    }

    this.showForm = false;
  }

  openDelete(row: any): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete user "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (confirmed && this.deleteTarget) {
      this.users = this.users.filter(u => u.id !== this.deleteTarget.id);
      this.alertService.success('User deleted');
    }
    this.deleteTarget = null;
  }

  openRoleInfo(role: RoleKey | string | null): void {
    if (!role) return;
    const key = role as RoleKey;
    if (!this.roleMetaMap[key]) return;
    this.roleInfoKey = key;
    this.roleInfoVisible = true;
  }

  closeRoleInfo(): void {
    this.roleInfoVisible = false;
    this.roleInfoKey = null;
  }
}
