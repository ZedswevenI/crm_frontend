import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-institute',
  standalone: false,
  templateUrl: './institute.component.html',
  styleUrl: './institute.component.scss',
})
export class InstituteComponent implements OnInit {
  instituteForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  columns = [
    { key: 'name', label: 'Institute Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'contactEmail', label: 'Email', sortable: false },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false },
  ];

  data: any[] = [
    {
      id: 1,
      name: 'Z7i Institute - Main',
      code: 'Z7I-MAIN',
      city: 'Coimbatore',
      contactEmail: 'info@z7iinstitute.com',
      phone: '9876543210',
      isActive: true,
    },
    {
      id: 2,
      name: 'Z7i Institute - Chennai',
      code: 'Z7I-CHN',
      city: 'Chennai',
      contactEmail: 'chennai@z7iinstitute.com',
      phone: '9123456780',
      isActive: true,
    },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: any) => this.edit(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Institute' },
    ]);
  }

  ngOnInit(): void {
    this.instituteForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      city: ['', Validators.required],
      contactEmail: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      isActive: [true],
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.instituteForm.reset({
      name: '',
      code: '',
      city: '',
      contactEmail: '',
      phone: '',
      isActive: true,
    });
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.id;
    this.instituteForm.reset({
      name: row.name,
      code: row.code,
      city: row.city,
      contactEmail: row.contactEmail,
      phone: row.phone,
      isActive: row.isActive,
    });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.instituteForm.invalid) {
      this.instituteForm.markAllAsTouched();
      return;
    }

    const value = this.instituteForm.value;

    if (this.formMode === 'create') {
      const newId = (this.data[this.data.length - 1]?.id || 0) + 1;
      this.data = [...this.data, { id: newId, ...value }];
      this.alertService.success('Institute created successfully');
    } else if (this.editingId != null) {
      this.data = this.data.map((i) =>
        i.id === this.editingId ? { ...i, ...value } : i
      );
      this.alertService.success('Institute updated successfully');
    }

    this.showForm = false;
  }

  openDelete(row: any): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete institute "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (confirmed && this.deleteTarget) {
      this.data = this.data.filter((i) => i.id !== this.deleteTarget.id);
      this.alertService.success('Institute deleted');
    }
    this.deleteTarget = null;
  }
}
