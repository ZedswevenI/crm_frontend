import { Component, OnInit } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

@Component({
  selector: 'app-phase-create',
  standalone: false,
  templateUrl: './phase-create.component.html',
  styleUrl: './phase-create.component.scss'
})
export class PhaseCreateComponent  implements OnInit {
 tenantId: string = '';
  loading = false;
  isEditMode = false;
  editData: any = null;
  phaseId: string = '';
  phaseForm!: FormGroup;

  allClasses = [
    { label: '6th', value: 6 },
    { label: '7th', value: 7 },
    { label: '8th', value: 8 },
    { label: '9th', value: 9 },
    { label: '10th', value: 10 },
    { label: '11th', value: 11 },
    { label: '12th', value: 12 },
    { label: '12th Pass', value: 13 },
  ];
  classes: any[] = [...this.allClasses];

  allSubjects: any[] = [];
  subjects: any[] = [];
  programs: any[] = [];
  selectedProgram: any = null;

  constructor(
    private breadcrump: BredcrumpService,
    private router: Router,
    private fb: FormBuilder,
    private commonApi: CommonapiService,
    private alert: AlertService,
  ) {
    this.tenantId = localStorage.getItem('tenantId') || '';
    const state: any = history.state;
    if (state?.phase) {
      this.isEditMode = true;
      this.editData = state.phase;
      this.phaseId = state.phase.phaseId;
      this.breadcrump.set([
        { label: 'Phase Plan', link: '/app/phase' },
        { label: 'Edit' },
      ]);
    } else {
      this.breadcrump.set([
        { label: 'Phase Plan', link: '/app/phase' },
        { label: 'Create' },
      ]);
    }
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadPrograms();
    this.loadSubjects();
  }

  private initializeForm(): void {
    this.phaseForm = this.fb.group({
      programId: ['', Validators.required],
      phaseName: ['', Validators.required],
      classNo: [null, Validators.required],
      subjectId: ['', Validators.required],
      sortOrder: [1, [Validators.required, Validators.min(1)]],
      topics: this.fb.array([]),
    });

    this.phaseForm.get('programId')?.valueChanges.subscribe((val) => {
      this.onProgramChange(val);
    });

    // Auto-add first topic row if creating new
    if (!this.isEditMode) {
      this.addTopic();
    }
  }

  get topicsArray(): FormArray {
    return this.phaseForm.get('topics') as FormArray;
  }

  addTopic(
    topicName = '',
    estHours: number | null = null,
    sortOrder?: number,
  ): void {
    const defaultSort = sortOrder || this.topicsArray.length + 1;
    this.topicsArray.push(
      this.fb.group({
        topicName: [topicName, Validators.required],
        estHours: [estHours, [Validators.required, Validators.min(1)]],
        sortOrder: [defaultSort, [Validators.required, Validators.min(1)]],
      }),
    );
  }

  removeTopic(index: number): void {
    this.topicsArray.removeAt(index);
  }

  onProgramChange(programId: string, resetFields = true): void {
    this.selectedProgram =
      this.programs.find((p) => p.programId === programId) || null;
    if (resetFields) {
      this.phaseForm.patchValue(
        { classNo: null, subjectId: '' },
        { emitEvent: false },
      );
    }
    if (!this.selectedProgram) {
      this.classes = [...this.allClasses];
      this.subjects = [...this.allSubjects];
      return;
    }
    this.classes = this.allClasses.filter(
      (c) =>
        c.value >= this.selectedProgram.startingClass &&
        c.value <= this.selectedProgram.endingClass,
    );
    const programSubjectIds: string[] = this.selectedProgram.subjects || [];
    this.subjects = this.allSubjects.filter((s) =>
      programSubjectIds.includes(s._id),
    );
  }

  private loadPrograms(): void {
    this.commonApi
      .fetchData({ entiId: this.tenantId }, 'ims/program', 'list?list=full')
      .subscribe({
        next: (res: any) =>
          (this.programs = (res?.data || []).filter(
            (p: any) => p.status === 'Active',
          )),
        error: () => this.alert.error('Error loading programs'),
      });
  }

  private loadSubjects(): void {
    this.commonApi
      .fetchData({ entiId: this.tenantId }, 'ims/subject', 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.allSubjects = res?.data || [];
          this.subjects = [...this.allSubjects];
          if (this.isEditMode && this.editData) this.populateEditForm();
        },
        error: () => this.alert.error('Error loading subjects'),
      });
  }

  private populateEditForm(): void {
    const d = this.editData;
    const programId =
      typeof d.programId === 'object' ? d.programId?.programId : d.programId;
    const subjectId =
      typeof d.subjectId === 'object' ? d.subjectId?._id : d.subjectId;

    if (programId) this.onProgramChange(programId, false);

    this.phaseForm.patchValue(
      {
        programId: programId || '',
        phaseName: d.phaseName,
        classNo: d.classNo,
        subjectId: subjectId,
        sortOrder: d.sortOrder,
      },
      { emitEvent: false },
    );

    this.phaseForm.get('classNo')?.disable({ emitEvent: false });
    this.phaseForm.get('subjectId')?.disable({ emitEvent: false });
    this.phaseForm.get('programId')?.disable({ emitEvent: false });

    this.topicsArray.clear();
    (d.topics || []).forEach((t: any) => {
      this.addTopic(t.topicName, t.estHours, t.sortOrder);
    });
  }

  submitPhase(): void {
    if (this.phaseForm.invalid) {
      this.alert.error('Please fill all required fields correctly');
      this.phaseForm.markAllAsTouched();
      return;
    }
    if (this.topicsArray.length === 0) {
      this.alert.error('You must add at least one topic');
      return;
    }

    const formValue = this.phaseForm.getRawValue(); // gets values even if disabled
    const payload = {
      tenantId: this.tenantId,
      programId: formValue.programId,
      phaseName: formValue.phaseName,
      classNo: Number(formValue.classNo),
      subjectId: formValue.subjectId,
      sortOrder: formValue.sortOrder,
      topics: formValue.topics, // Directly passing the array since it matches required fields
    };

    this.loading = true;
    if (this.isEditMode) {
      Object.assign(payload, { phaseId: this.phaseId });
      this.commonApi.fetchData(payload, 'institue/phase', 'update').subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res?.status) {
            this.alert.success('Phase plan updated');
            this.router.navigate(['/app/phase']);
          }
        },
        error: (e) => {
          this.loading = false;
          this.alert.error(e.error.message);
        },
      });
    } else {
      this.commonApi.fetchData(payload, 'institue/phase', 'create').subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res?.status) {
            this.alert.success('Phase plan created');
            this.router.navigate(['/app/phase']);
          }
        },
        error: (e) => {
          this.loading = false;
          this.alert.error(e.error.message);
        },
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/app/phase']);
  }
}
