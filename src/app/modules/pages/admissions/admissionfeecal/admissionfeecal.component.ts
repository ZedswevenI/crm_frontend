import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';

import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

interface ProgramItem {
  programId: string;
  programName: string;
  programCode?: string;
}

interface FeePlan {
  id: string;
  name: string;
  feePlanCode?: string;
  instalments: Array<{ seq: number; label: string; amount: number; dueDate?: string | null }>;
  feeHeads: Array<{ key: string; label: string; fee: number; stax: number }>;
}

@Component({
  selector: 'app-admissionfeecal',
  standalone: false,
  templateUrl: './admissionfeecal.component.html',
  styleUrl: './admissionfeecal.component.scss'
})
export class AdmissionfeecalComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: UntypedFormGroup;

  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  readonly PRINT_LOGO_URL = '../../../../../assets/logo.png';

  // masters
  private programsSub = new BehaviorSubject<ProgramItem[]>([]);
  programs$ = this.programsSub.asObservable();
  programsLoading$ = new BehaviorSubject<boolean>(false);

  private feePlansSub = new BehaviorSubject<FeePlan[]>([]);
  feePlans$ = this.feePlansSub.asObservable();
  feePlansLoading$ = new BehaviorSubject<boolean>(false);

  private feePlanReload$ = new Subject<void>();

  constructor(
    private fb: UntypedFormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Admissions' }, { label: 'Fee Calculator' }]);
  }

  // ----- streams (same pattern as your admission screen) -----
  readonly programId$ = () =>
    this.form.get('programId')!.valueChanges.pipe(
      startWith(this.form.get('programId')!.value),
      map((v) => String(v || '').trim()),
      distinctUntilChanged()
    );

  readonly feePlanId$ = () =>
    this.form.get('feePlanId')!.valueChanges.pipe(
      startWith(this.form.get('feePlanId')!.value),
      map((v) => String(v || '').trim()),
      distinctUntilChanged()
    );

  readonly selectedPlan$ = () =>
    combineLatest([this.feePlans$, this.feePlanId$()]).pipe(
      map(([plans, id]) => plans.find((p) => p.id === id) || null),
      shareReplay(1)
    );

  readonly testScholarshipPct$ = () =>
    this.form.get('testScholarshipPct')!.valueChanges.pipe(
      startWith(this.form.get('testScholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged()
    );

  readonly scholarshipPct$ = () =>
    this.form.get('scholarshipPct')!.valueChanges.pipe(
      startWith(this.form.get('scholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged()
    );

  readonly additionalScholarshipPct$ = () =>
    this.form.get('additionalScholarshipPct')!.valueChanges.pipe(
      startWith(this.form.get('additionalScholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged()
    );

  readonly feeHeadPreview$ = () =>
    combineLatest([this.selectedPlan$(), this.testScholarshipPct$(), this.scholarshipPct$(), this.additionalScholarshipPct$()]).pipe(
      map(([plan, t, s, a]) => this.computeFeeHeadPreview(plan, t, s, a)),
      shareReplay(1)
    );

  readonly finalFee$ = () =>
    this.feeHeadPreview$().pipe(
      map((rows) => rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0)),
      shareReplay(1)
    );

  readonly totalDiscountPct$ = () =>
    combineLatest([this.testScholarshipPct$(), this.scholarshipPct$(), this.additionalScholarshipPct$()]).pipe(
      map(([t, s, a]) => this.computeTotalDiscountPct(t, s, a)),
      shareReplay(1)
    );

  readonly instalmentPreview$ = () =>
    combineLatest([this.selectedPlan$(), this.finalFee$()]).pipe(
      map(([plan, finalFee]) => this.computeInstalmentPreview(plan, this.roundRupee(finalFee))),
      shareReplay(1)
    );

  // ----- init -----
  ngOnInit(): void {
    this.form = this.fb.group({
      programId: ['', Validators.required],
      programName: [''],
      programCode: [''],
      feePlanId: ['', Validators.required],
      feePlanCode: [''],

      testScholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      scholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      additionalScholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
    });

    this.loadPrograms();

    // program change => clear feeplan and reload feeplans (cancellable)
    this.form
      .get('programId')!
      .valueChanges.pipe(
        map((v) => String(v || '').trim()),
        distinctUntilChanged(),
        debounceTime(50),
        tap((pid) => this.applyProgramFromMaster(pid)),
        tap(() => this.feePlanReload$.next()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // feeplan change => update feePlanCode
    this.selectedPlan$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((plan) => {
        this.form.patchValue({ feePlanCode: plan?.feePlanCode || '' }, { emitEvent: false });
      });

    // loader stream
    this.feePlanReload$
      .pipe(
        startWith(void 0),
        switchMap(() => this.fetchFeePlans$()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  // ----- UI actions -----
  resetAll(): void {
    this.form.reset(
      {
        programId: '',
        programName: '',
        programCode: '',
        feePlanId: '',
        feePlanCode: '',
        testScholarshipPct: 0,
        scholarshipPct: 0,
        additionalScholarshipPct: 0,
      },
      { emitEvent: true }
    );
    this.feePlansSub.next([]);
  }

  printFeeCalculator(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.alert.error('Select Program and Fee Plan first.');
      return;
    }

    const planId = String(this.form.get('feePlanId')?.value || '').trim();
    const plan = this.feePlansSub.getValue().find((p) => p.id === planId) || null;
    if (!plan) {
      this.alert.error('Please select a valid fee plan.');
      return;
    }

    const v = this.form.getRawValue();
    const heads = this.computeFeeHeadPreview(
      plan,
      Number(v.testScholarshipPct || 0),
      Number(v.scholarshipPct || 0),
      Number(v.additionalScholarshipPct || 0)
    );

    const finalFee = this.roundRupee(heads.reduce((s: number, r: any) => s + Number(r.total || 0), 0));
    const instals = this.computeInstalmentPreview(plan, finalFee);

    const programName = String(v.programName || '').trim();
    const programCode = String(v.programCode || '').trim();
    const feePlanName = String(plan.name || '').trim();
    const feePlanCode = String(plan.feePlanCode || v.feePlanCode || '').trim();

    const html = this.buildFeeCalcPrintHtml(programName, programCode, feePlanName, feePlanCode, heads, instals, finalFee);
    this.openPrintWindow('Fee Calculator', html);
  }

  // ----- trackBy -----
  trackByIndex = (i: number) => i;
  trackByProgramId = (_: number, x: ProgramItem) => x.programId;
  trackByFeePlanId = (_: number, x: FeePlan) => x.id;
  trackByFeeHeadLabel = (_: number, x: any) => x.label;

  // ----- masters load -----
  private loadPrograms(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    this.programsLoading$.next(true);
    const body: any = { entiId: tenantId };

    this.api
      .fetchData(body, 'ims/program', 'list?list=full')
      .pipe(
        catchError(() => {
          this.programsLoading$.next(false);
          this.programsSub.next([]);
          this.alert.error('Failed to load programs');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        this.programsLoading$.next(false);

        if (!res?.status) {
          this.programsSub.next([]);
          this.alert.error(res?.message || res?.error || 'Failed to load programs');
          return;
        }

        const arr = Array.isArray(res?.data) ? res.data : [];
        const programs = arr
          .map((x: any) => ({
            programId: String(x.programId || x._id || x.id || '').trim(),
            programName: String(x.programName || x.name || '').trim(),
            programCode: String(x.programCodes || x.programCode || '').trim(),
          }))
          .filter((p: ProgramItem) => !!p.programId && !!p.programName);

        this.programsSub.next(programs);
      });
  }

  private fetchFeePlans$() {
    const tenantId = this.pickTenantId();
    if (!tenantId) return of(null);

    const programId = String(this.form.get('programId')?.value || '').trim();
    if (!programId) {
      this.feePlansSub.next([]);
      this.form.patchValue({ feePlanId: '', feePlanCode: '' }, { emitEvent: false });
      return of(null);
    }

    this.feePlansLoading$.next(true);
    const body: any = { entiId: tenantId };
    const route = `list?list=full&programId=${encodeURIComponent(programId)}`;

    return this.api.fetchData(body, 'ims/feeplan', route).pipe(
      catchError(() => {
        this.feePlansLoading$.next(false);
        this.feePlansSub.next([]);
        this.alert.error('Failed to load fee plans');
        return of(null);
      }),
      tap((res: any) => {
        this.feePlansLoading$.next(false);

        if (!res?.status) {
          this.feePlansSub.next([]);
          this.alert.error(res?.message || res?.error || 'Failed to load fee plans');
          return;
        }

        const arr = Array.isArray(res?.data) ? res.data : [];
        const plans: FeePlan[] = arr
          .map((x: any) => ({
            id: String(x.feePlanId || x.id || x._id || '').trim(),
            name: String(x.feePlanName || x.feePlanCode || x.name || 'Fee Plan').trim(),
            feePlanCode: x.feePlanCode ? String(x.feePlanCode).trim() : '',
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  amount: Number(i.amount || 0) || 0,
                  dueDate: i.dueDate ? String(i.dueDate) : null,
                }))
              : [],
            feeHeads: Array.isArray(x.feeHeads)
              ? x.feeHeads.map((h: any) => ({
                  key: String(h.key || h.feeHeadKey || '').trim(),
                  label: String(h.label || h.feeHeadName || '').trim(),
                  fee: Number(h.amount || 0),
                  stax: Number(h.gstAmount || 0),
                }))
              : [],
          }))
          .filter((fp: FeePlan) => !!fp.id);

        this.feePlansSub.next(plans);

        const cur = String(this.form.get('feePlanId')?.value || '').trim();
        const exists = !!plans.find((p) => p.id === cur);

        if (cur && !exists) {
          this.form.patchValue({ feePlanId: '', feePlanCode: '' }, { emitEvent: false });
        }

        const after = String(this.form.get('feePlanId')?.value || '').trim();
        if (!after && plans.length) {
          this.form.patchValue({ feePlanId: plans[0].id }, { emitEvent: true });
        }
      })
    );
  }

  private applyProgramFromMaster(programId: string): void {
    const pid = String(programId || '').trim();
    const p = this.programsSub.getValue().find((x) => x.programId === pid) || null;

    this.form.patchValue(
      {
        programName: p?.programName || '',
        programCode: p?.programCode || '',
        feePlanId: '',
        feePlanCode: '',
      },
      { emitEvent: false }
    );

    // clear fee plans list until loaded
    this.feePlansSub.next([]);
  }

  // ----- computations (copied from your admission screen logic) -----
  private computeFeeHeadPreview(
    plan: FeePlan | null,
    testPct: number,
    schlPct: number,
    addPct: number
  ): Array<{ label: string; fee: number; stax: number; total: number; scholBenefits: number }> {
    const heads = plan?.feeHeads || [];
    if (!heads.length) return [];

    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));
    const p1 = clamp(testPct);
    const p2 = clamp(schlPct);
    const p3 = clamp(addPct);

    const applyPct = (amount: number, pct: number) => {
      const out = Math.round(amount * (1 - pct / 100));
      return out < 0 ? 0 : out;
    };

    return heads.map((h) => {
      const fee0 = Number(h.fee || 0);
      const tax0 = Number(h.stax || 0);
      const rate = fee0 > 0 ? tax0 / fee0 : 0;

      let outFee = fee0;
      let outTax = tax0;
      let scholBenefits = 0;

      const key = String(h.key || '').trim().toLowerCase();
      const isTuition =
        key === 'tuition' ||
        key === 'tuitionfee' ||
        key === 'tuition_fee' ||
        String(h.label || '').toLowerCase().includes('tuition');

      if (isTuition) {
        const fee1 = applyPct(outFee, p1);
        const tax1 = Math.round(fee1 * rate);

        const fee2 = applyPct(fee1, p2);
        const tax2 = Math.round(fee2 * rate);

        const fee3 = applyPct(fee2, p3);
        const tax3 = Math.round(fee3 * rate);

        outFee = fee3;
        outTax = tax3;
        scholBenefits = Math.max(0, fee0 + tax0 - (outFee + outTax));
      }

      return { label: h.label, fee: outFee, stax: outTax, total: outFee + outTax, scholBenefits };
    });
  }

  private computeTotalDiscountPct(t: number, s: number, a: number): number {
    const A = Math.max(0, Math.min(100, t || 0)) / 100;
    const B = Math.max(0, Math.min(100, s || 0)) / 100;
    const C = Math.max(0, Math.min(100, a || 0)) / 100;
    const eff = 1 - (1 - A) * (1 - B) * (1 - C);
    return Math.round(eff * 10000) / 100;
  }

  private computeInstalmentPreview(plan: FeePlan | null, finalFee: number): Array<any> {
    const instals = plan?.instalments || [];
    if (!instals.length || finalFee <= 0) return [];

    const baseAmounts = instals.map((i) => Number(i.amount) || 0);
    const baseTotal = baseAmounts.reduce((s, x) => s + (Number(x) || 0), 0);
    const scaled = this.scalePlan(baseAmounts, finalFee, baseTotal);

    return instals.map((i, idx) => {
      const dueISO = this.toDateInputISO(i.dueDate || i.label || null);
      return {
        sno: idx + 1,
        label: String(i.label || `Instalment ${idx + 1}`).trim(),
        dueDate: this.isoToDDMMYYYY(dueISO) || '',
        mode: idx === 0 ? 'NEFT' : 'CHEQUE',
        amount: Number(scaled[idx] || 0),
      };
    });
  }

  private scalePlan(amounts: number[], targetTotal: number, baseTotal: number): number[] {
    const target = this.roundRupee(targetTotal);
    if (!baseTotal || target <= 0) return amounts.map(() => 0);

    const raw = amounts.map((a) => (Number(a || 0) / baseTotal) * target);
    const rounded = raw.map((x) => {
      const base = Math.floor(x);
      const frac = x - base;
      return frac >= 0.5 ? base + 1 : base;
    });

    let sum = rounded.reduce((s, x) => s + x, 0);
    let diff = target - sum;

    let idx = rounded.length - 1;
    while (diff > 0 && rounded.length) {
      rounded[idx] = rounded[idx] + 1;
      diff--;
      idx--;
      if (idx < 0) idx = rounded.length - 1;
    }

    idx = rounded.length - 1;
    while (diff < 0 && rounded.length) {
      if (rounded[idx] > 0) {
        rounded[idx] = rounded[idx] - 1;
        diff++;
      }
      idx--;
      if (idx < 0) idx = rounded.length - 1;
    }

    return rounded;
  }

  private toDateInputISO(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoMatch?.[1]) return isoMatch[1];

    // dd-mm-yyyy
    const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
      const dd = dmyDash[1].padStart(2, '0');
      const mm = dmyDash[2].padStart(2, '0');
      const yyyy = dmyDash[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // dd/mm/yyyy
    const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmySlash) {
      const dd = dmySlash[1].padStart(2, '0');
      const mm = dmySlash[2].padStart(2, '0');
      const yyyy = dmySlash[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // fallback
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  private isoToDDMMYYYY(iso: any): string {
    const s = String(iso || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`; // dd-mm-yyyy
  }

  private roundRupee(v: any): number {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return 0;
    const base = Math.floor(Math.abs(n));
    const frac = Math.abs(n) - base;
    const rounded = frac >= 0.5 ? base + 1 : base;
    return n < 0 ? -rounded : rounded;
  }

  // ----- printing (same style as your openPrintWindow) -----
  private buildFeeCalcPrintHtml(
    programName: string,
    programCode: string,
    feePlanName: string,
    feePlanCode: string,
    heads: any[],
    instals: any[],
    finalFee: number
  ): string {
    const today = new Date();

    const headRows = heads
      .map(
        (r: any) => `
      <tr>
        <td>${this.esc(r.label)}</td>
        <td class="text-right">${Number(r.fee || 0).toLocaleString('en-IN')}</td>
        <td class="text-right">${Number(r.stax || 0).toLocaleString('en-IN')}</td>
        <td class="text-right"><b>${Number(r.total || 0).toLocaleString('en-IN')}</b></td>
        <td class="text-right">${Number(r.scholBenefits || 0).toLocaleString('en-IN')}</td>
      </tr>
    `
      )
      .join('');

    const instalRows = instals
      .map(
        (x: any) => `
      <tr>
        <td class="text-center">${x.sno}</td>
        <td>${this.esc(x.label)}</td>
        <td>${this.esc(x.dueDate || '')}</td>
        <td class="text-center">${this.esc(x.mode || '')}</td>
        <td class="text-right">${Number(x.amount || 0).toLocaleString('en-IN')}</td>
      </tr>
    `
      )
      .join('');

    return `
    <div class="page">
      <div class="brand-center">
        <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
      </div>

      <div class="title-main">FEE CALCULATOR</div>
      <div class="subtitle">Program & Fee Plan based fee breakup</div>

      <div class="meta-row">
        <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
        <div><b>Prepared On :</b> ${today.toLocaleString('en-IN')}</div>
      </div>

      <div class="section">
        <div class="section-title">Program Details</div>
        <div class="kv-grid">
          <div class="kv-label">Program</div><div>${this.esc(programName || '')}</div>
          <div class="kv-label">Program Code</div><div>${this.esc(programCode || '')}</div>
          <div class="kv-label">Fee Plan</div><div>${this.esc(feePlanName || '')}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Fee Head-wise Split</div>
        <table>
          <thead>
            <tr>
              <th>Fee Head</th>
              <th class="text-right" style="width:140px;">Fee</th>
              <th class="text-right" style="width:140px;">STax</th>
              <th class="text-right" style="width:140px;">Total</th>
              <th class="text-right" style="width:170px;">Scholarship Benefits</th>
            </tr>
          </thead>
          <tbody>
            ${headRows || `<tr><td colspan="5" class="text-center">No fee heads</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3" class="text-right">Grand Total</th>
              <th class="text-right">₹ ${Number(finalFee || 0).toLocaleString('en-IN')}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Instalment Schedule</div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;" class="text-center">S.No</th>
              <th>Instalment</th>
              <th style="width:120px;">Due Date</th>
              <th style="width:90px;" class="text-center">Mode</th>
              <th style="width:140px;" class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${instalRows || `<tr><td colspan="5" class="text-center">No instalments</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4" class="text-right">Total</th>
              <th class="text-right">₹ ${Number(finalFee || 0).toLocaleString('en-IN')}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  }

  private openPrintWindow(title: string, bodyHtml: string): void {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      this.alert.error('Popup blocked. Please allow popups to print.');
      return;
    }

    const fullHtml = `<!doctype html>
    <html>
    <head>
    <meta charset="utf-8" />
    <title>${this.esc(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; margin: 16px; color: #111827; }
      .page { width: 100%; max-width: 800px; margin: 0 auto; }
      .title-main { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; text-align:center; }
      .subtitle { font-size: 11px; margin-top: 2px; text-align:center; }
      table { width:100%; border-collapse: collapse; margin-top: 4px; }
      th, td { border:1px solid #e5e7eb; padding: 3px 4px; vertical-align: top; }
      th { background:#f3f4f6; font-weight:600; }
      .text-right { text-align:right; }
      .text-center { text-align:center; }
      .section { margin-top: 10px; }
      .section-title { font-weight: 700; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin-bottom: 4px; }
      .brand-center { display:flex; justify-content:center; align-items:center; margin-bottom: 6px; }
      .brand-center img { height: 46px; width:auto; object-fit:contain; display:block; }
      .meta-row { margin-top: 6px; display:flex; justify-content: space-between; font-size: 10px; }
      .kv-grid { display: grid; grid-template-columns: 32% 68%; border: 1px solid #e5e7eb; }
      .kv-grid > div { border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 3px 4px; }
      .kv-grid > div:nth-child(2n) { border-right: none; }
      .kv-label { background: #f9fafb; font-weight: 600; font-size: 10px; }
    </style>
    </head>
    <body onload="window.print();">
      ${bodyHtml}
    </body>
    </html>`;

    win.document.open();
    win.document.write(fullHtml);
    win.document.close();
  }

  private esc(v: any): string {
    const s = String(v ?? '');
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return s.replace(/[&<>"']/g, (c) => map[c] || c);
  }

  private pickTenantId(): string {
    return (localStorage.getItem('entiId') || '').trim() || (localStorage.getItem('tenantId') || '').trim();
  }

  get alert$() {
    return this.alert.alert$;
  }

  clearAlert(): void {
    this.alert.clear();
  }
}
