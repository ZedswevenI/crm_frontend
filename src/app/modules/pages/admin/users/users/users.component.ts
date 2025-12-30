import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { UserService } from '../../../../../service/admin/user.service';
import { CenterService } from '../../../../../service/admin/orgmasters/center.service';

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
  editingId: string | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  roleInfoVisible = false;
  roleInfoKey: RoleKey | null = null;

  entiId : any

  users: any[] = [];

  centers: any[] = [];

  centerOptions: any[] = [];


  columns = [
    { key: 'name', label: 'User Name', sortable: true },
    { key: 'loginId', label: 'Login ID', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'roleLabel', label: 'Role', sortable: false },
    { key: 'status', label: 'Active', sortable: false }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-circle-info',
      tooltip: 'Role permissions',
      callback: (row: any) => this.openRoleInfo(row.roleLevel as RoleKey)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row)
    }
  ];

  roleOptions = [
    { value: 'L1', label: 'L1 - Academic Head' },
    { value: 'L2', label: 'L2 - Admission Manager' },
    { value: 'L3', label: 'L3 - Accounts Manager' },
    { value: 'L4', label: 'L4 - Academic Operations' }
  ];

  // ✅ ROLE META MAP — USED AS-IS (UNCHANGED)
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
        'MIS report for upcoming cheque deposits',
        'Mark deposited cheques as collected / dishonoured',
        'Handle replacement of dishonoured cheques',
        'Accounts report generation'
      ]
    },
    L4: {
      key: 'L4',
      title: 'L4 - Academic Operations',
      subtitle: 'Operational control for classes and attendance.',
      permissions: [
        'Timetable management',
        'Batch association',
        'Faculty mapping',
        'Attendance & academic reports'
      ]
    }
  };

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService,
    private userService: UserService,
    private centerService: CenterService

  ) {
    this.entiId = localStorage.getItem('tenantId')
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Users & Roles' },
      { label: 'Users' }
    ]);
  }

  // ===============================
  // INIT
  // ===============================
  ngOnInit(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      loginId: ['', Validators.required],
      role: [null, Validators.required],
      empCode: ['', Validators.required],
      password: ['', Validators.required],
      centerId: [null, Validators.required],
      isActive: [true]
    });

    this.loadUsers();
    this.loadCenters()
  }

  loadCenters(): void {
    this.centerService.listCenters(this.entiId).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Failed to load centers');
          return;
        }
        this.centers = res?.data || [];
        this.centerOptions = this.centers.map((c: any) => ({
          label: c.centerName,
          value: c._id
        }));
      },
      error: () => this.alertService.error('Server error while loading centers')
    });
  }


  get currentRoleMeta(): RoleMeta | null {
    if (!this.roleInfoKey) return null;
    return this.roleMetaMap[this.roleInfoKey];
  }

  // ===============================
  // LIST
  // ===============================
  loadUsers(): void {
    this.userService.listUsers(this.entiId).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Failed to load users');
          return;
        }
        this.users = res?.data || [];
      },
      error: () => this.alertService.error('Server error while loading users')
    });
  }

  // ===============================
  // ADD
  // ===============================
  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.userForm.reset({ isActive: true });
    this.showForm = true;
  }

  // ===============================
  // EDIT
  // ===============================
  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row._id;

    this.userForm.patchValue({
      name: row.name,
      email: row.email,
      phone: row.phone,
      loginId: row.loginId,
      role: row.roleLevel,
      isActive: row.status === 'Active'
    });

    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  // ===============================
  // SAVE (CREATE / UPDATE)
  // ===============================
  save(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    console.log("Centeres ",this.centers);
    
    const f = this.userForm.value;
    
    const selectedCenter = this.centers.find(
      (c: any) => c.centerId === f.centerId
    );
    const roleOpt = this.roleOptions.find(r => r.value === f.role);

    // common payload
    const payload: any = {
      entiId: this.entiId,
      name: f.name,
      email: f.email,
      phone: f.phone,
      roleLevel: f.role,
      status: f.isActive ? 'Active' : 'Inactive',
      empCode: f.empCode,
      centerId: f.centerId,
      centerName: selectedCenter
    };

    // CREATE-specific fields
    if (this.formMode === 'create') {
      payload.password = f.password;
    }

    const api$ =
      this.formMode === 'create'
        ? this.userService.createUser(payload)
        : this.userService.updateUser({
          ...payload,
          recId: this.editingId
        });

    api$.subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Operation failed');
          return;
        }

        this.alertService.success(
          this.formMode === 'create'
            ? 'User created successfully'
            : 'User updated successfully'
        );

        this.showForm = false;
        this.loadUsers();
      },
      error: () => this.alertService.error('Server error')
    });
  }


  // ===============================
  // DELETE (L1 BLOCKED)
  // ===============================
  openDelete(row: any): void {
    if (row.roleLevel === 'L1') {
      this.alertService.error('L1 (Academic Head) users cannot be deleted.');
      return;
    }
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete user "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;

    if (!confirmed || !this.deleteTarget) return;

    if (this.deleteTarget.roleLevel === 'L1') {
      this.alertService.error('L1 (Academic Head) users cannot be deleted.');
      this.deleteTarget = null;
      return;
    }

    this.userService
      .deleteUser(this.entiId, this.deleteTarget._id)
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alertService.error(res?.message || 'Delete failed');
            return;
          }
          this.alertService.success('User deleted');
          this.loadUsers();
        },
        error: () => this.alertService.error('Server error')
      });

    this.deleteTarget = null;
  }

  // ===============================
  // ROLE INFO
  // ===============================
  openRoleInfo(role: RoleKey | null): void {
    if (!role || !this.roleMetaMap[role]) return;
    this.roleInfoKey = role;
    this.roleInfoVisible = true;
  }

  closeRoleInfo(): void {
    this.roleInfoVisible = false;
    this.roleInfoKey = null;
  }
}
