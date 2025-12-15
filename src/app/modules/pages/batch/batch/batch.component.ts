import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';

interface Batch {
  id: number;
  name: string;
  code: string;
  programId: number;
  programName: string;
  centerId: number;
  centerName: string;
  academicYear: string;
  startDate: string | null;
  endDate: string | null;
  plannedStrength?: number | null;
  isActive: boolean;
}

interface ProgramOption {
  id: number;
  name: string;
}

interface CenterOption {
  id: number;
  name: string;
}

interface Student {
  id: number;
  name: string;
  enrolmentNo: string;
  programId: number;
  programName: string;
  centerId: number;
  centerName: string;
  phone: string;
}

@Component({
  selector: 'app-batch',
  standalone: false,
  templateUrl: './batch.component.html',
  styleUrl: './batch.component.scss',
})
export class BatchComponent implements OnInit {
  batchForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;

  // delete modal
  deleteModalVisible = false;
  deleteTarget: Batch | null = null;
  deleteMessage = '';

  // map students modal
  showMapModal = false;
  selectedBatch: Batch | null = null;

  // filters for map modal
  filterProgram: number | 'all' = 'all';
  filterCenter: number | 'all' = 'all';
  filterSearch: string = '';

  // dummy programs & centres
  programs: ProgramOption[] = [
    { id: 1, name: 'JEE 2 Year Classroom' },
    { id: 2, name: 'NEET 1 Year Repeaters' },
    { id: 3, name: 'Foundation 9-10' },
  ];

  centers: CenterOption[] = [
    { id: 1, name: 'Gandhipuram Center' },
    { id: 2, name: 'Nungambakkam Center' },
  ];

  // program & centre dropdown options
  programOptions = this.programs.map((p) => ({ label: p.name, value: p.id }));
  centerOptions = this.centers.map((c) => ({ label: c.name, value: c.id }));

  // filter dropdowns (include "All")
  programFilterOptions = [
    { label: 'All Programs', value: 'all' as const },
    ...this.programOptions,
  ];

  centerFilterOptions = [
    { label: 'All Centres', value: 'all' as const },
    ...this.centerOptions,
  ];

  // dummy batches
  batchData: Batch[] = [
    {
      id: 1,
      name: 'JEE 2026 - Phase 1',
      code: 'JEE26-P1',
      programId: 1,
      programName: 'JEE 2 Year Classroom',
      centerId: 1,
      centerName: 'Gandhipuram Center',
      academicYear: '2024-2026',
      startDate: '2024-04-01',
      endDate: '2026-03-31',
      plannedStrength: 40,
      isActive: true,
    },
    {
      id: 2,
      name: 'NEET 2025 - Regular',
      code: 'NEET25-REG',
      programId: 2,
      programName: 'NEET 1 Year Repeaters',
      centerId: 2,
      centerName: 'Nungambakkam Center',
      academicYear: '2024-2025',
      startDate: '2024-06-01',
      endDate: '2025-03-31',
      plannedStrength: 60,
      isActive: true,
    },
  ];

  // list-table columns
  columns = [
    { key: 'name', label: 'Batch Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'centerName', label: 'Centre', sortable: true },
    { key: 'academicYear', label: 'Academic Year', sortable: true },
    { key: 'plannedStrength', label: 'Planned', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false },
  ];

  // actions (Edit / Map / Delete)
  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit Batch',
      color: '#6B7280',
      callback: (row: Batch) => this.edit(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-user-group',
      tooltip: 'Map Students',
      color: '#2563EB',
      callback: (row: Batch) => this.openMapModal(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: Batch) => this.openDelete(row),
    },
  ];

  // dummy students (global pool)
  students: Student[] = [
    {
      id: 101,
      name: 'Rohit Sharma',
      enrolmentNo: 'JEE26-0001',
      programId: 1,
      programName: 'JEE 2 Year Classroom',
      centerId: 1,
      centerName: 'Gandhipuram Center',
      phone: '9000010001',
    },
    {
      id: 102,
      name: 'Sanjana Iyer',
      enrolmentNo: 'JEE26-0002',
      programId: 1,
      programName: 'JEE 2 Year Classroom',
      centerId: 1,
      centerName: 'Gandhipuram Center',
      phone: '9000010002',
    },
    {
      id: 103,
      name: 'Harish Kumar',
      enrolmentNo: 'NEET25-0001',
      programId: 2,
      programName: 'NEET 1 Year Repeaters',
      centerId: 2,
      centerName: 'Nungambakkam Center',
      phone: '9000020001',
    },
    {
      id: 104,
      name: 'Megha Varma',
      enrolmentNo: 'FDN24-0001',
      programId: 3,
      programName: 'Foundation 9-10',
      centerId: 1,
      centerName: 'Gandhipuram Center',
      phone: '9000030001',
    },
  ];

  /**
   * batchStudentMap keeps student IDs per batch:
   * {
   *   [batchId]: number[]
   * }
   */
  batchStudentMap: Record<number, number[]> = {
    1: [101, 102],
    2: [103],
  };

  // temp selection for "Add Selected to Batch"
  selectedToAdd: Set<number> = new Set<number>();

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Batches' },
    ]);
  }

  ngOnInit(): void {
    this.batchForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      programId: [null, Validators.required],
      centerId: [null, Validators.required],
      academicYear: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: [''],
      plannedStrength: [null],
      isActive: [true],
    });
  }

  // ---------- CRUD: BATCH ----------

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.batchForm.reset({
      name: '',
      code: '',
      programId: null,
      centerId: null,
      academicYear: '',
      startDate: '',
      endDate: '',
      plannedStrength: null,
      isActive: true,
    });
    this.showForm = true;
    this.setBodyModalOpen(true);
  }

  edit(row: Batch): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    this.batchForm.reset({
      name: row.name,
      code: row.code,
      programId: row.programId,
      centerId: row.centerId,
      academicYear: row.academicYear,
      startDate: row.startDate,
      endDate: row.endDate,
      plannedStrength: row.plannedStrength ?? null,
      isActive: row.isActive,
    });

    this.showForm = true;
    this.setBodyModalOpen(true);
  }

  cancel(): void {
    this.showForm = false;
    this.setBodyModalOpen(this.showMapModal); // keep locked if map modal open
  }

  save(): void {
    if (this.batchForm.invalid) {
      this.batchForm.markAllAsTouched();
      return;
    }

    const value = this.batchForm.value;
    const program = this.programs.find((p) => p.id === value.programId);
    const center = this.centers.find((c) => c.id === value.centerId);

    const payload: Batch = {
      id: this.editingId ?? 0,
      name: value.name,
      code: value.code,
      programId: value.programId,
      programName: program?.name || '',
      centerId: value.centerId,
      centerName: center?.name || '',
      academicYear: value.academicYear,
      startDate: value.startDate || null,
      endDate: value.endDate || null,
      plannedStrength: value.plannedStrength ?? null,
      isActive: value.isActive,
    };

    if (this.formMode === 'create') {
      const newId = (this.batchData[this.batchData.length - 1]?.id || 0) + 1;
      this.batchData = [...this.batchData, { ...payload, id: newId }];
      this.alertService.success('Batch created successfully');
    } else if (this.editingId != null) {
      this.batchData = this.batchData.map((b) =>
        b.id === this.editingId ? { ...payload, id: this.editingId! } : b
      );
      this.alertService.success('Batch updated successfully');
    }

    this.showForm = false;
  }

  openDelete(row: Batch): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete batch "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;

    if (confirmed && this.deleteTarget) {
      this.batchData = this.batchData.filter(
        (b) => b.id !== this.deleteTarget!.id
      );
      delete this.batchStudentMap[this.deleteTarget.id];
      this.alertService.success('Batch deleted');
    }

    this.deleteTarget = null;
  }

  // ---------- MAP STUDENTS ----------

  openMapModal(batch: Batch): void {
    this.selectedBatch = batch;
    this.filterProgram = 'all';
    this.filterCenter = 'all';
    this.filterSearch = '';
    this.selectedToAdd.clear();
    this.showMapModal = true;
    this.setBodyModalOpen(true);
  }

  closeMapModal(): void {
    this.showMapModal = false;
    this.selectedBatch = null;
    this.selectedToAdd.clear();
    this.setBodyModalOpen(this.showForm);
  }

  ngOnDestroy(): void {
    this.setBodyModalOpen(false);
  }

  get mappedStudents(): Student[] {
    if (!this.selectedBatch) return [];
    const ids = this.batchStudentMap[this.selectedBatch.id] || [];
    return this.students.filter((s) => ids.includes(s.id));
  }

  get filteredAvailableStudents(): Student[] {
    if (!this.selectedBatch) return [];

    const mappedIds = new Set(
      this.batchStudentMap[this.selectedBatch.id] || []
    );

    return this.students
      .filter((s) => !mappedIds.has(s.id))
      .filter((s) => {
        if (
          this.filterProgram !== 'all' &&
          s.programId !== this.filterProgram
        ) {
          return false;
        }
        if (this.filterCenter !== 'all' && s.centerId !== this.filterCenter) {
          return false;
        }
        if (this.filterSearch) {
          const q = this.filterSearch.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            s.enrolmentNo.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }

  isSelectedToAdd(studentId: number): boolean {
    return this.selectedToAdd.has(studentId);
  }

  toggleSelectToAdd(studentId: number, checked: boolean): void {
    if (checked) {
      this.selectedToAdd.add(studentId);
    } else {
      this.selectedToAdd.delete(studentId);
    }
  }

  addSelectedToBatch(): void {
    if (!this.selectedBatch || this.selectedToAdd.size === 0) {
      return;
    }

    const currentIds = new Set(
      this.batchStudentMap[this.selectedBatch.id] || []
    );
    this.selectedToAdd.forEach((id) => currentIds.add(id));
    this.batchStudentMap[this.selectedBatch.id] = Array.from(currentIds);

    this.alertService.success('Students mapped to batch');
    this.selectedToAdd.clear();
  }

  removeFromBatch(studentId: number): void {
    if (!this.selectedBatch) return;
    const ids = this.batchStudentMap[this.selectedBatch.id] || [];
    this.batchStudentMap[this.selectedBatch.id] = ids.filter(
      (id) => id !== studentId
    );
    this.alertService.success('Student removed from batch');
  }

  private setBodyModalOpen(open: boolean) {
    document.body.classList.toggle('modal-open', open);
  }
}
