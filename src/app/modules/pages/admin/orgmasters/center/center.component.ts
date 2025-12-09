import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-center',
  standalone: false,
  templateUrl: './center.component.html',
  styleUrl: './center.component.scss'
})
export class CenterComponent implements OnInit {
  centerForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;

  columns = [
    { key: 'name', label: 'Center Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'instituteName', label: 'Institute', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'state', label: 'State', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false }
  ];

  // dummy institutes for dropdown
  institutes = [
    { id: 1, name: 'Z7i Institute - Main' },
    { id: 2, name: 'Z7i Institute - Chennai' }
  ];

  centerData: any[] = [
    {
      id: 1,
      name: 'Gandhipuram Center',
      code: 'CT-GDP',
      instituteId: 1,
      instituteName: 'Z7i Institute - Main',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      isActive: true
    },
    {
      id: 2,
      name: 'Nungambakkam Center',
      code: 'CT-NGM',
      instituteId: 2,
      instituteName: 'Z7i Institute - Chennai',
      city: 'Chennai',
      state: 'Tamil Nadu',
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

  instituteOptions = this.institutes.map((i) => ({
    label: i.name,
    value: i.id
  }));

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Org Configs' },
      { label: 'Masters' },
      { label: 'Centers' }
    ]);
  }

  ngOnInit(): void {
    this.centerForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      instituteId: [null, Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      isActive: [true]
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.centerForm.reset({ isActive: true });
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.id;
    this.centerForm.patchValue({
      name: row.name,
      code: row.code,
      instituteId: row.instituteId,
      city: row.city,
      state: row.state,
      isActive: row.isActive
    });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.centerForm.invalid) {
      this.centerForm.markAllAsTouched();
      return;
    }
    const value = this.centerForm.value;
    const inst = this.institutes.find((i) => i.id === value.instituteId);
    const payload = {
      ...value,
      instituteName: inst?.name || ''
    };

    if (this.formMode === 'create') {
      const newId = (this.centerData[this.centerData.length - 1]?.id || 0) + 1;
      this.centerData = [...this.centerData, { id: newId, ...payload }];
      this.alertService.success('Center created successfully');
    } else if (this.editingId != null) {
      this.centerData = this.centerData.map((c) =>
        c.id === this.editingId ? { ...c, ...payload } : c
      );
      this.alertService.success('Center updated successfully');
    }
    this.showForm = false;
  }

  delete(row: any): void {
    if (confirm(`Delete center "${row.name}"?`)) {
      this.centerData = this.centerData.filter((c) => c.id !== row.id);
      this.alertService.success('Center deleted');
    }
  }
}