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
  topicsLoading = false;

  // Edit mode
  isEditMode = false;
  editData: any = null;
  phaseId: string = '';

  phaseForm!: FormGroup;

  classes = [
    { label: '6th', value: 6 },
    { label: '7th', value: 7 },
    { label: '8th', value: 8 },
    { label: '9th', value: 9 },
    { label: '10th', value: 10 },
    { label: '11th', value: 11 },
    { label: '12th', value: 12 },
    { label: '12th Pass', value: 13 }
  ];

  subjects: any[] = [];
  availableTopics: any[] = [];

  constructor(
    private breadcrump: BredcrumpService,
    private router: Router,
    private fb: FormBuilder,
    private commonApi: CommonapiService,
    private alert: AlertService
  ) {
    this.tenantId = localStorage.getItem('tenantId') || '';

    const state: any = history.state;
    if (state?.phase) {
      this.isEditMode = true;
      this.editData = state.phase;
      this.phaseId = state.phase.phaseId;
      this.breadcrump.set([{ label: 'Phase Plan', link: '/app/phase' }, { label: 'Edit' }]);
    } else {
      this.breadcrump.set([{ label: 'Phase Plan', link: '/app/phase' }, { label: 'Create' }]);
    }
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadSubjects();
  }

  private initializeForm(): void {
    this.phaseForm = this.fb.group({
      phaseName: ['', Validators.required],
      classNo: [null, Validators.required],
      subjectId: ['', Validators.required],
      sortOrder: [1, [Validators.required, Validators.min(1)]],
      topics: this.fb.array([])
    });

    // When class or subject changes, reload topics (only in create mode)
    this.phaseForm.get('classNo')?.valueChanges.subscribe(() => {
      if (!this.isEditMode) this.onClassOrSubjectChange();
    });

    this.phaseForm.get('subjectId')?.valueChanges.subscribe(() => {
      if (!this.isEditMode) this.onClassOrSubjectChange();
    });
  }

  get topicsArray(): FormArray {
    return this.phaseForm.get('topics') as FormArray;
  }

  private loadSubjects(): void {
    const body = { entiId: this.tenantId };
    this.commonApi.fetchData(body, 'ims/subject', 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.subjects = res?.data || [];

          // After subjects load, populate form if edit mode
          if (this.isEditMode && this.editData) {
            this.populateEditForm();
          }
        },
        error: () => this.alert.error('Error loading subjects')
      });
  }

  // ─── Edit Mode ────────────────────────────────────────────────────────────
  private populateEditForm(): void {
    const d = this.editData;

    // Patch header fields first (without triggering valueChanges topic reload)
    this.phaseForm.patchValue({
      phaseName: d.phaseName,
      classNo: d.classNo,
      subjectId: d.subjectId,
      sortOrder: d.sortOrder
    }, { emitEvent: false });

    // Disable header fields — these shouldn't change in edit
    this.phaseForm.get('classNo')?.disable();
    this.phaseForm.get('subjectId')?.disable();

    // Now load available topics for the class+subject, then merge with existing
    this.loadAvailableTopicsForEdit(d.classNo, d.subjectId, d.topics || []);
  }

  private loadAvailableTopicsForEdit(classNo: number, subjectId: string, existingTopics: any[]): void {
    this.topicsLoading = true;

    const body = {
      tenantId: this.tenantId,
      classNo: Number(classNo),
      subjectId: subjectId
    };

    this.commonApi.fetchData(body, 'batch/phase', 'available-topics')
      .subscribe({
        next: (res: any) => {
          this.availableTopics = res?.data || [];
          this.buildTopicsFormArrayForEdit(this.availableTopics, existingTopics);
          this.topicsLoading = false;
        },
        error: () => {
          this.alert.error('Error loading topics');
          this.topicsLoading = false;
        }
      });
  }

  /**
   * Merge available topics with existing phase topics:
   * - If a topic exists in the phase → pre-select it and fill estHours
   * - If a topic is only in available → show it unselected
   * - If a topic is only in existing (removed from master) → still show it selected
   */
  private buildTopicsFormArrayForEdit(available: any[], existing: any[]): void {
    console.log("Avaabe ", existing);

    this.topicsArray.clear();

    // Build a quick lookup map from existing topics
    const existingMap = new Map<string, any>();
    existing.forEach(t => existingMap.set(t.topicId, t));

    // Build a set of topicIds already covered from available list
    const availableIds = new Set(available.map(t => t.topicId));

    // 1. Loop through available topics
    available.forEach((topic: any) => {
      const existingEntry = existingMap.get(topic.topicId);
      const isSelected = !!existingEntry;
      const estHours = existingEntry?.estHours ?? null;

      this.topicsArray.push(
        this.buildTopicGroup(topic.topicId, topic.topicName, topic.sortOrder, estHours, isSelected)
      );
    });

    // 2. Append any existing topics NOT in the available list (edge case)
    existing.forEach((t: any) => {
      if (!availableIds.has(t.topicId)) {
        this.topicsArray.push(
          this.buildTopicGroup(t.topicId, t.topicName, t.sortOrder, t.estHours, true)
        );
      }
    });

  }

  // ─── Create Mode ──────────────────────────────────────────────────────────

  private onClassOrSubjectChange(): void {
    const classNo = this.phaseForm.get('classNo')?.value;
    const subjectId = this.phaseForm.get('subjectId')?.value;

    this.topicsArray.clear();
    this.availableTopics = [];

    if (classNo && subjectId) {
      this.loadAvailableTopics(classNo, subjectId);
    }
  }

  private loadAvailableTopics(classNo: number, subjectId: string): void {
    this.topicsLoading = true;
    const body = {
      tenantId: this.tenantId,
      classNo: Number(classNo),
      subjectId: subjectId
    };

    this.commonApi.fetchData(body, 'batch/phase', 'available-topics')
      .subscribe({
        next: (res: any) => {
          this.availableTopics = res?.data || [];
          this.buildTopicsFormArray();
          this.topicsLoading = false;
        },
        error: () => {
          this.alert.error('Error loading topics');
          this.topicsLoading = false;
        }
      });
  }

  private buildTopicsFormArray(): void {
    this.topicsArray.clear();
    this.availableTopics.forEach((topic: any) => {
      this.topicsArray.push(
        this.buildTopicGroup(topic.topicId, topic.topicName, topic.sortOrder, null, true)
      );
    });
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  private buildTopicGroup(
    topicId: string,
    topicName: string,
    sortOrder: number,
    estHours: number | null,
    selected: boolean
  ): FormGroup {
    const group = this.fb.group({
      topicId: [topicId],
      topicName: [topicName],
      sortOrder: [sortOrder],
      estHours: [estHours, selected ? [Validators.min(1)] : []],
      selected: [selected]
    });

    if (!selected) {
      group.get('estHours')?.disable();
    }

    // Toggle estHours on checkbox change
    group.get('selected')?.valueChanges.subscribe((isSelected: any) => {
      const ctrl = group.get('estHours');
      if (isSelected) {
        ctrl?.enable();
        ctrl?.setValidators([Validators.min(1)]);
      } else {
        ctrl?.disable();
        ctrl?.clearValidators();
        ctrl?.setValue(null);
      }
      ctrl?.updateValueAndValidity();
    });

    return group;
  }

  isAllSelected(): boolean {
    return this.topicsArray.controls.length > 0 &&
      this.topicsArray.controls.every(c => c.get('selected')?.value === true);
  }

  onSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.topicsArray.controls.forEach(c => c.get('selected')?.setValue(checked));
  }

  getTopicControl(index: number, controlName: string) {
    return this.topicsArray.at(index).get(controlName);
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  submitPhase(): void {
    if (this.phaseForm.invalid) {
      this.alert.error('Please fill all required fields');
      this.phaseForm.markAllAsTouched();
      return;
    }

    const formValue = this.phaseForm.getRawValue();

    const selectedTopics = formValue.topics
      .filter((t: any) => t.selected)
      .map((t: any) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        estHours: Number(t.estHours),
        sortOrder: t.sortOrder
      }));

    if (selectedTopics.length === 0) {
      this.alert.error('Please select at least one topic');
      return;
    }

    if (this.isEditMode) {
      this.updatePhase(formValue, selectedTopics);
    } else {
      this.createPhase(formValue, selectedTopics);
    }
  }

  private createPhase(formValue: any, selectedTopics: any[]): void {
    const payload = {
      tenantId: this.tenantId,
      phaseName: formValue.phaseName,
      classNo: Number(formValue.classNo),
      subjectId: formValue.subjectId,
      sortOrder: formValue.sortOrder,
      topics: selectedTopics
    };

    this.loading = true;
    this.commonApi.fetchData(payload, 'batch/phase', 'create')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res?.status) {
            this.alert.success('Phase plan created successfully');
            this.router.navigate(['/app/phase']);
          }
        },
        error: (e) => {
          this.loading = false;
          this.alert.error(e.error.message)
        }
      });
  }

  private updatePhase(formValue: any, selectedTopics: any[]): void {
    const payload = {
      tenantId: this.tenantId,
      phaseId: this.phaseId,
      phaseName: formValue.phaseName,
      sortOrder: formValue.sortOrder,
      topics: selectedTopics
    };

    this.loading = true;
    this.commonApi.fetchData(payload, 'batch/phase', 'update')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res?.status) {
            this.alert.success('Phase plan updated successfully');
            this.router.navigate(['/app/phase']);
          }
        },
        error: (e) => {
          this.loading = false;
          this.alert.error(e.error.message)
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/app/phase']);
  }
}
