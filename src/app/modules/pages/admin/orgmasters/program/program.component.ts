import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-program',
  standalone: false,
  templateUrl: './program.component.html',
  styleUrl: './program.component.scss'
})
export class ProgramComponent implements OnInit {
  programForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;

  columns = [
    { key: 'name', label: 'Program Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'stream', label: 'Stream', sortable: true },
    { key: 'duration', label: 'Duration Type', sortable: true },
    { key: 'isActive', label: 'Active', sortable: false }
  ];

  programData: any[] = [
    {
      id: 1,
      name: 'JEE 2 Year Classroom',
      code: 'JEE-2Y-CLS',
      stream: 'JEE',
      duration: '2 Years',
      isActive: true
    },
    {
      id: 2,
      name: 'NEET 1 Year Repeaters',
      code: 'NEET-1Y-REP',
      stream: 'NEET',
      duration: '1 Year',
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

  streamOptions = [
    { label: 'JEE', value: 'JEE' },
    { label: 'NEET', value: 'NEET' },
    { label: 'Foundation', value: 'Foundation' }
  ];

  durationOptions = [
    { label: '2 Years', value: '2 Years' },
    { label: '1 Year', value: '1 Year' },
    { label: 'Crash Course', value: 'Crash Course' }
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Programs' }
    ]);
  }

  ngOnInit(): void {
    this.programForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      stream: [null, Validators.required],
      duration: [null, Validators.required],
      isActive: [true]
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.programForm.reset({ isActive: true });
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.id;
    this.programForm.patchValue(row);
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.programForm.invalid) {
      this.programForm.markAllAsTouched();
      return;
    }
    const value = this.programForm.value;

    if (this.formMode === 'create') {
      const newId = (this.programData[this.programData.length - 1]?.id || 0) + 1;
      this.programData = [...this.programData, { id: newId, ...value }];
      this.alertService.success('Program created successfully');
    } else if (this.editingId != null) {
      this.programData = this.programData.map((p) =>
        p.id === this.editingId ? { ...p, ...value } : p
      );
      this.alertService.success('Program updated successfully');
    }
    this.showForm = false;
  }

  delete(row: any): void {
    if (confirm(`Delete program "${row.name}"?`)) {
      this.programData = this.programData.filter((p) => p.id !== row.id);
      this.alertService.success('Program deleted');
    }
  }
}