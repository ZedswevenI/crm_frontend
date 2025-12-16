import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type EntryStatus = 'draft' | 'submitted';

interface SubjectDef {
  key: string; // form control key
  name: string; // display
  maxMarks: number; // validation
}

interface ExamInfo {
  id: string;
  name: string;
  code: string;
  batchName: string;
  programName: string;
}

interface StudentRow {
  regNo: string;
  name: string;
  batchName: string;
}

@Component({
  selector: 'app-exammarks',
  standalone: false,
  templateUrl: './exammarks.component.html',
  styleUrl: './exammarks.component.scss'
})
export class ExammarksComponent implements OnInit {

  examId = '';
  exam: ExamInfo | null = null;

  entryStatus: EntryStatus = 'draft';
  saving = false;
  lastSavedAt: string | null = null;

  search = '';
  filteredRows: Array<{ __idx: number }> = [];

  // ✅ define subjects for this exam (dummy now; later load from API)
  subjects: SubjectDef[] = [
    { key: 'physics', name: 'Physics', maxMarks: 100 },
    { key: 'chemistry', name: 'Chemistry', maxMarks: 100 },
    { key: 'maths', name: 'Maths', maxMarks: 100 }
  ];

  // forms
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Exams' }, { label: 'Marks Entry' }]);
  }

  ngOnInit(): void {
    this.examId = String(this.route.snapshot.paramMap.get('id') || '').trim();

    // build form
    this.form = this.fb.group({
      rows: this.fb.array([] as any[])
    });

    // load exam + students (dummy)
    this.loadExamAndStudents();
  }

  back(): void {
    this.router.navigate(['/app/exams/setup']);
  }

  reload(): void {
    this.loadExamAndStudents();
    this.alert.success('Refreshed (dummy).');
  }

  // ---------------- Form helpers ----------------
  get rowsFA(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  rowCtrl(idx: number, key: string) {
    return (this.rowsFA.at(idx) as FormGroup).get(key);
  }

  // ---------------- Load dummy data ----------------
  private loadExamAndStudents(): void {
    // TODO: replace with API calls
    this.exam = {
      id: this.examId || 'EX-001',
      name: 'Unit Test - Physics 01',
      code: 'UT-PHY-01',
      batchName: 'JEE 2026 - Phase 1',
      programName: 'JEE 2 Year Classroom'
    };

    const students: StudentRow[] = [
      { regNo: 'JEE26-0001', name: 'Rohit Sharma', batchName: 'JEE 2026 - Phase 1' },
      { regNo: 'JEE26-0002', name: 'Sanjana Iyer', batchName: 'JEE 2026 - Phase 1' }
    ];

    // build rows
    const fa = this.fb.array([] as any[]);
    for (const s of students) {
      const g: any = {
        regNo: [s.regNo],
        name: [s.name],
        batchName: [s.batchName],
        absent: [false]
      };

      // subject controls with validators 0..max
      for (const sub of this.subjects) {
        g[sub.key] = [0, [Validators.min(0), Validators.max(sub.maxMarks)]];
      }

      fa.push(this.fb.group(g) as any);
    }

    this.form.setControl('rows', fa as any);

    // if you load from backend, also load entryStatus draft/submitted
    this.entryStatus = 'draft';

    this.applyFilter();
  }

  // ---------------- UI behaviours ----------------
  applyFilter(): void {
    const q = (this.search || '').trim().toLowerCase();
    const out: Array<{ __idx: number }> = [];

    for (let i = 0; i < this.rowsFA.length; i++) {
      const regNo = String(this.rowCtrl(i, 'regNo')?.value || '').toLowerCase();
      const name = String(this.rowCtrl(i, 'name')?.value || '').toLowerCase();
      if (!q || regNo.includes(q) || name.includes(q)) {
        out.push({ __idx: i });
      }
    }
    this.filteredRows = out;
  }

  onAbsentToggle(idx: number): void {
    const absent = !!this.rowCtrl(idx, 'absent')?.value;
    if (absent) {
      // clear marks when absent
      for (const s of this.subjects) {
        this.rowCtrl(idx, s.key)?.setValue(0, { emitEvent: false });
        this.rowCtrl(idx, s.key)?.markAsUntouched();
      }
    }
  }

  getTotal(idx: number): number {
    const absent = !!this.rowCtrl(idx, 'absent')?.value;
    if (absent) return 0;
    let sum = 0;
    for (const s of this.subjects) {
      const v = Number(this.rowCtrl(idx, s.key)?.value || 0);
      sum += Number.isFinite(v) ? v : 0;
    }
    return sum;
  }

  getPercent(idx: number): string {
    const max = this.subjects.reduce((s, x) => s + x.maxMarks, 0) || 0;
    if (!max) return '0.0';
    const pct = (this.getTotal(idx) / max) * 100;
    return pct.toFixed(1);
  }

  // ---------------- Save/Submit ----------------
  saveDraft(): void {
    if (this.entryStatus === 'submitted') return;

    // validate ranges
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please correct invalid marks (0 to max).');
      return;
    }

    this.saving = true;

    const payload = {
      examId: this.exam?.id,
      status: 'draft',
      rows: this.rowsFA.value
    };

    console.log('SAVE DRAFT PAYLOAD', payload);

    setTimeout(() => {
      this.saving = false;
      this.lastSavedAt = new Date().toLocaleString();
      this.alert.success('Draft saved (dummy).');
    }, 300);
  }

  submitMarks(): void {
    if (this.entryStatus === 'submitted') return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please correct invalid marks (0 to max).');
      return;
    }

    // additional rule: if not absent, at least one subject should be entered (optional)
    for (let i = 0; i < this.rowsFA.length; i++) {
      const absent = !!this.rowCtrl(i, 'absent')?.value;
      if (!absent) {
        const total = this.getTotal(i);
        if (total < 0) {
          this.alert.error('Invalid marks.');
          return;
        }
      }
    }

    this.saving = true;

    const payload = {
      examId: this.exam?.id,
      status: 'submitted',
      rows: this.rowsFA.value
    };

    console.log('SUBMIT PAYLOAD', payload);

    setTimeout(() => {
      this.saving = false;
      this.entryStatus = 'submitted';
      this.lastSavedAt = new Date().toLocaleString();
      this.alert.success('Marks submitted and locked (dummy).');
    }, 350);
  }
}
