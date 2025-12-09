import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-staff',
  standalone: false,
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.scss'
})
export class StaffComponent implements OnInit {
  staffForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;

  columns = [
    { key: 'name', label: 'Staff Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    { key: 'centerName', label: 'Center', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false }
  ];

  centers = [
    { id: 1, name: 'Gandhipuram Center' },
    { id: 2, name: 'Nungambakkam Center' }
  ];

  staffData: any[] = [
    {
      id: 1,
      name: 'Arun Kumar',
      code: 'STF-ARUN',
      role: 'Faculty',
      centerId: 1,
      centerName: 'Gandhipuram Center',
      phone: '9000000001',
      email: 'arun.faculty@z7i.com',
      isActive: true
    },
    {
      id: 2,
      name: 'Divya Priya',
      code: 'STF-DIVYA',
      role: 'Centre Head',
      centerId: 2,
      centerName: 'Nungambakkam Center',
      phone: '9000000002',
      email: 'divya.head@z7i.com',
      isActive: true
    }
  ];

  actions = [
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
      callback: (row: any) => this.delete(row)
    }
  ];

  roleOptions = [
    { label: 'Faculty', value: 'Faculty' },
    { label: 'Centre Head', value: 'Centre Head' },
    { label: 'Counsellor', value: 'Counsellor' },
    { label: 'Admin', value: 'Admin' }
  ];

  centerOptions = this.centers.map((c) => ({
    label: c.name,
    value: c.id
  }));

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Staff' }
    ]);
  }

  ngOnInit(): void {
    this.staffForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      role: [null, Validators.required],
      centerId: [null, Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      isActive: [true]
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.staffForm.reset({ isActive: true });
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.id;
    this.staffForm.patchValue({
      name: row.name,
      code: row.code,
      role: row.role,
      centerId: row.centerId,
      phone: row.phone,
      email: row.email,
      isActive: row.isActive
    });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      return;
    }
    const value = this.staffForm.value;
    const center = this.centers.find((c) => c.id === value.centerId);
    const payload = {
      ...value,
      centerName: center?.name || ''
    };

    if (this.formMode === 'create') {
      const newId = (this.staffData[this.staffData.length - 1]?.id || 0) + 1;
      this.staffData = [...this.staffData, { id: newId, ...payload }];
      this.alertService.success('Staff created successfully');
    } else if (this.editingId != null) {
      this.staffData = this.staffData.map((s) =>
        s.id === this.editingId ? { ...s, ...payload } : s
      );
      this.alertService.success('Staff updated successfully');
    }
    this.showForm = false;
  }

  delete(row: any): void {
    if (confirm(`Delete staff "${row.name}"?`)) {
      this.staffData = this.staffData.filter((s) => s.id !== row.id);
      this.alertService.success('Staff deleted');
    }
  }
}