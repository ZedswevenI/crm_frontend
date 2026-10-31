import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, combineLatest, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
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
  instalments: Array<{
    seq: number;
    label: string;
    amount: number;
    dueDate?: number | null;
    feeHead?: string | null;
    discountApplied?: boolean | null;
    mode?: string | null;
    feeFor?: string | null;
    favourOf?: string | null;
  }>;
  feeHeads: Array<{ key: string; label: string; fee: number; stax: number }>;
}

@Component({
  selector: 'app-admissionfeecal',
  standalone: false,
  templateUrl: './admissionfeecal.component.html',
  styleUrl: './admissionfeecal.component.scss',
})
export class AdmissionfeecalComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: UntypedFormGroup;

  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  readonly PRINT_LOGO_URL = `${window.location.origin}/assets/logo.png`;

  // FeePlan "ALL" value
  readonly ALL_FEEPLAN_ID = '__ALL__';

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
    private api: CommonapiService,
  ) {
    this.breadcrumb.set([
      { label: 'Admissions & Fees' },
      { label: 'Admission' },
      { label: 'Fee Calculator' },
    ]);
  }

  // ----- streams -----
  readonly programId$ = () =>
    this.form.get('programId')!.valueChanges.pipe(
      startWith(this.form.get('programId')!.value),
      map((v) => String(v || '').trim()),
      distinctUntilChanged(),
    );

  readonly feePlanId$ = () =>
    this.form.get('feePlanId')!.valueChanges.pipe(
      startWith(this.form.get('feePlanId')!.value),
      map((v) => String(v || '').trim()),
      distinctUntilChanged(),
    );

  readonly isAllSelected$ = () =>
    this.feePlanId$().pipe(
      map((id) => id === this.ALL_FEEPLAN_ID),
      distinctUntilChanged(),
      shareReplay(1),
    );

  // selected single plan ONLY (null if ALL)
  readonly selectedPlan$ = () =>
    combineLatest([this.feePlans$, this.feePlanId$()]).pipe(
      map(([plans, id]) => {
        if (!id || id === this.ALL_FEEPLAN_ID) return null;
        return plans.find((p) => p.id === id) || null;
      }),
      shareReplay(1),
    );

  readonly testScholarshipPct$ = () =>
    this.form.get('testScholarshipPct')!.valueChanges.pipe(
      startWith(this.form.get('testScholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged(),
    );

  readonly scholarshipPct$ = () =>
    this.form.get('scholarshipPct')!.valueChanges.pipe(
      startWith(this.form.get('scholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged(),
    );

  readonly additionalScholarshipPct$ = () =>
    this.form.get('additionalScholarshipPct')!.valueChanges.pipe(
      startWith(this.form.get('additionalScholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged(),
    );

  readonly totalDiscountPct$ = () =>
    combineLatest([
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ]).pipe(
      map(([t, s, a]) => this.computeTotalDiscountPct(t, s, a)),
      shareReplay(1),
    );

  readonly feeHeadPreview$ = () =>
    combineLatest([
      this.selectedPlan$(),
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ]).pipe(
      map(([plan, t, s, a]) => this.computeFeeHeadPreview(plan, t, s, a)),
      shareReplay(1),
    );

  readonly finalFee$ = () =>
    this.feeHeadPreview$().pipe(
      map((rows) =>
        this.roundRupee(
          rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0),
        ),
      ),
      shareReplay(1),
    );

  // ✅ UPDATED: instalment preview now:
  // 1) applies discount ONLY on rows where discountApplied=true
  // 2) merges instalments having same instalmentDate AFTER discount
  // 3) reconciles rounding diff to match finalFee (adjust last row)
  readonly instalmentPreview$ = () =>
    combineLatest([
      this.selectedPlan$(),
      this.finalFee$(),
      this.totalDiscountPct$(),
    ]).pipe(
      map(([plan, finalFee, effDisc]) =>
        this.computeInstalmentPreview(plan, finalFee, effDisc),
      ),
      shareReplay(1),
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // feeplan change => update feePlanCode (only for single selection)
    this.selectedPlan$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((plan) => {
        this.form.patchValue(
          { feePlanCode: plan?.feePlanCode || '' },
          { emitEvent: false },
        );
      });

    // loader stream
    this.feePlanReload$
      .pipe(
        startWith(void 0),
        switchMap(() => this.fetchFeePlans$()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  // ----- helpers -----
  isAllSelected(): boolean {
    const id = String(this.form.get('feePlanId')?.value || '').trim();
    return id === this.ALL_FEEPLAN_ID;
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
      { emitEvent: true },
    );
    this.feePlansSub.next([]);
  }

  printFeeCalculator(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.alert.error('Select Program and Fee Plan first.');
      return;
    }

    const feePlanId = String(this.form.get('feePlanId')?.value || '').trim();
    const allPlans = this.feePlansSub.getValue() || [];

    if (!allPlans.length) {
      this.alert.error('No fee plans available for selected program.');
      return;
    }

    const v = this.form.getRawValue();
    const t = Number(v.testScholarshipPct || 0);
    const s = Number(v.scholarshipPct || 0);
    const a = Number(v.additionalScholarshipPct || 0);

    const programName = String(v.programName || '').trim();
    const programCode = String(v.programCode || '').trim();

    // which plans to print?
    let plansToPrint: FeePlan[] = [];
    if (feePlanId === this.ALL_FEEPLAN_ID) {
      plansToPrint = allPlans.slice();
    } else {
      const one = allPlans.find((p) => p.id === feePlanId) || null;
      if (!one) {
        this.alert.error('Please select a valid fee plan.');
        return;
      }
      plansToPrint = [one];
    }

    const effDisc = this.computeTotalDiscountPct(t, s, a);

    const scholarshipText = [
      `Test Scholarship ${t}%`,
      s > 0 ? `${s}%` : '',
      a > 0 ? `${a}%` : '',
    ]
      .filter(Boolean)
      .join(' + ');

    // build multi-page html (one plan per page)
    const pagesHtml = plansToPrint
      .map((plan, idx) => {
        const heads = this.computeFeeHeadPreview(plan, t, s, a);
        const finalFee = this.roundRupee(
          heads.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0),
        );

        // ✅ UPDATED call
        const instals = this.computeInstalmentPreview(plan, finalFee, effDisc);

        const feePlanName = String(plan.name || '').trim();

        return this.buildFeeCalcPrintHtml(
          programName,
          programCode,
          feePlanName,
          scholarshipText,
          instals,
          finalFee,
          idx > 0, // pageBreakBefore
        );
      })
      .join('');

    this.openPrintWindow('Fee Calculator', pagesHtml);
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        this.programsLoading$.next(false);

        if (!res?.status) {
          this.programsSub.next([]);
          this.alert.error(
            res?.message || res?.error || 'Failed to load programs',
          );
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
      this.form.patchValue(
        { feePlanId: '', feePlanCode: '' },
        { emitEvent: false },
      );
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
          this.alert.error(
            res?.message || res?.error || 'Failed to load fee plans',
          );
          return;
        }

        const arr = Array.isArray(res?.data) ? res.data : [];
        const plans: FeePlan[] = arr
          .map((x: any) => ({
            id: String(x.feePlanId || x.id || x._id || '').trim(),
            name: String(
              x.feePlanName || x.feePlanCode || x.name || 'Fee Plan',
            ).trim(),
            feePlanCode: x.feePlanCode ? String(x.feePlanCode).trim() : '',

            // ✅ UPDATED mapping (covers what you were missing)
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  amount: Number(i.amount || 0) || 0,

                  // backend: instalmentDate (number ms). keep it as number for compare/merge
                  dueDate:
                    i.instalmentDate !== undefined && i.instalmentDate !== null
                      ? Number(i.instalmentDate)
                      : null,

                  // backend: feeHead + discountApplied (needed for discount logic)
                  feeHead: i.feeHead ? String(i.feeHead).trim() : null,
                  discountApplied: i.discountApplied === true,

                  mode: i.mode ? String(i.mode).trim() : null,
                  feeFor: i.label ? String(i.label).trim() : null,
                  favourOf: i.chequeFavour
                    ? String(i.chequeFavour).trim()
                    : null,
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
        const exists =
          cur === this.ALL_FEEPLAN_ID || !!plans.find((p) => p.id === cur);

        if (cur && !exists) {
          this.form.patchValue(
            { feePlanId: '', feePlanCode: '' },
            { emitEvent: false },
          );
        }

        const after = String(this.form.get('feePlanId')?.value || '').trim();
        if (!after && plans.length) {
          this.form.patchValue({ feePlanId: plans[0].id }, { emitEvent: true });
        }
      }),
    );
  }

  private applyProgramFromMaster(programId: string): void {
    const pid = String(programId || '').trim();
    const p =
      this.programsSub.getValue().find((x) => x.programId === pid) || null;

    this.form.patchValue(
      {
        programName: p?.programName || '',
        programCode: p?.programCode || '',
        feePlanId: '',
        feePlanCode: '',
      },
      { emitEvent: false },
    );

    this.feePlansSub.next([]);
  }

  // ----- computations -----
  private computeFeeHeadPreview(
    plan: FeePlan | null,
    testPct: number,
    schlPct: number,
    addPct: number,
  ): Array<{
    label: string;
    fee: number;
    stax: number;
    total: number;
    scholBenefits: number;
  }> {
    const heads = plan?.feeHeads || [];
    if (!heads.length) return [];

    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));
    const p1 = clamp(testPct);
    const p2 = clamp(schlPct);
    const p3 = clamp(addPct);

    const applyPct = (amount: number, pct: number) => {
      const out = Math.round(Number(amount || 0) * (1 - pct / 100));
      return out < 0 ? 0 : out;
    };

    return heads.map((h) => {
      const fee0 = Number(h.fee || 0);
      const tax0 = Number(h.stax || 0);
      const rate = fee0 > 0 ? tax0 / fee0 : 0;

      let outFee = fee0;
      let outTax = tax0;
      let scholBenefits = 0;

      const key = String(h.key || '')
        .trim()
        .toLowerCase();
      const isTuition =
        key === 'tuition' ||
        key === 'tuitionfee' ||
        key === 'tuition_fee' ||
        String(h.label || '')
          .toLowerCase()
          .includes('tuition');

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

      return {
        label: h.label,
        fee: outFee,
        stax: outTax,
        total: outFee + outTax,
        scholBenefits,
      };
    });
  }

  private computeTotalDiscountPct(t: number, s: number, a: number): number {
    const A = Math.max(0, Math.min(100, t || 0)) / 100;
    const B = Math.max(0, Math.min(100, s || 0)) / 100;
    const C = Math.max(0, Math.min(100, a || 0)) / 100;
    const eff = 1 - (1 - A) * (1 - B) * (1 - C);
    return Math.round(eff * 10000) / 100;
  }

  /**
   * ✅ UPDATED instalment logic as per your requirement:
   * 1) discount only for instalments where discountApplied=true
   * 2) AFTER discount, merge same instalmentDate (numeric compare)
   * 3) Convert date to DD-MM-YYYY only at the end
   * 4) Ensure sum equals finalFee by adjusting last row diff
   */
  private computeInstalmentPreview(
    plan: FeePlan | null,
    finalFee: number,
    effectiveDiscountPct: number,
  ): Array<any> {
    const instals = Array.isArray(plan?.instalments) ? plan!.instalments : [];
    const target = this.roundRupee(finalFee);
    if (!instals.length || target <= 0) return [];

    const discPct = Math.max(
      0,
      Math.min(100, Number(effectiveDiscountPct || 0)),
    );

    const applyDiscountIfNeeded = (amount: number, isDiscount: boolean) => {
      const a = this.safeNum(amount);
      if (!isDiscount || discPct <= 0) return Math.round(a);
      const out = a * (1 - discPct / 100);
      return Math.round(out);
    };

    // 1) apply discount line-by-line (only discountApplied=true)
    const lines = instals
      .map((i) => {
        const dateMs =
          i.dueDate !== undefined && i.dueDate !== null
            ? Number(i.dueDate)
            : null;
        const isDisc = i.discountApplied === true;

        const amt = applyDiscountIfNeeded(i.amount, isDisc);

        return {
          dateMs,
          amount: amt,
          mode: (i.mode ? String(i.mode).trim() : '') || '',
          feeFor:
            (i.feeFor ? String(i.feeFor).trim() : '') ||
            (i.label ? String(i.label).trim() : '') ||
            '',
          favourOf: (i.favourOf ? String(i.favourOf).trim() : '') || '',
          // keep original seq for stable ordering
          seq: this.safeNum(i.seq),
        };
      })
      // ignore fully empty amounts
      .filter((x) => this.safeNum(x.amount) > 0);

    if (!lines.length) return [];

    // sort by date then seq
    lines.sort((a, b) => {
      const da = a.dateMs === null ? -1 : a.dateMs;
      const db = b.dateMs === null ? -1 : b.dateMs;
      if (da !== db) return da - db;
      return a.seq - b.seq;
    });

    // 2) group by SAME dateMs (numeric compare)
    const byDate = new Map<string, any>();

    const keyOf = (dateMs: number | null) =>
      dateMs === null ? 'NULL' : String(dateMs);

    for (const ln of lines) {
      const k = keyOf(ln.dateMs);

      if (!byDate.has(k)) {
        byDate.set(k, {
          dateMs: ln.dateMs,
          amount: 0,
          modes: new Set<string>(),
          feeFors: new Set<string>(),
          favourOf: '',
          minSeq: ln.seq,
        });
      }

      const g = byDate.get(k);
      g.amount = this.safeNum(g.amount) + this.safeNum(ln.amount);
      if (ln.mode) g.modes.add(ln.mode);
      if (ln.feeFor) g.feeFors.add(ln.feeFor);
      if (!g.favourOf && ln.favourOf) g.favourOf = ln.favourOf;
      g.minSeq = Math.min(this.safeNum(g.minSeq), this.safeNum(ln.seq));
    }

    const groups = Array.from(byDate.values()).sort((a, b) => {
      const da = a.dateMs === null ? -1 : a.dateMs;
      const db = b.dateMs === null ? -1 : b.dateMs;
      if (da !== db) return da - db;
      return this.safeNum(a.minSeq) - this.safeNum(b.minSeq);
    });

    // 3) reconcile rounding diff to match target (adjust last group)
    const sumNow = groups.reduce((s, g) => s + this.safeNum(g.amount), 0);
    let diff = target - sumNow;

    if (diff !== 0 && groups.length) {
      const last = groups[groups.length - 1];
      const newAmt = this.safeNum(last.amount) + diff;
      last.amount = newAmt < 0 ? 0 : newAmt;
    }

    // 4) build preview rows
    return groups.map((g, idx) => {
      const dateStr = this.millisToDDMMYYYY(g.dateMs);
      const modeArr = Array.from(g.modes || []);
      const mode =
        modeArr.length === 1 ? modeArr[0] : modeArr.length > 1 ? 'MULTI' : '';

      const feeForArr = Array.from(g.feeFors || []).filter(Boolean);
      const feeFor = feeForArr.length ? feeForArr.join(' + ') : '-';

      return {
        sno: idx + 1,
        label: feeFor, // keep UI label meaningful after merge
        dueDate: dateStr || '',
        mode: mode || (idx === 0 ? 'NEFT' : 'CHEQUE'),
        amount: this.roundRupee(g.amount),
        feeFor,
        favourOf: g.favourOf ? String(g.favourOf).trim() : '-',
      };
    });
  }

  // ----- helpers -----
  private safeNum(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private roundRupee(v: any): number {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
  }

  // ✅ new helper: backend sends date as ms number. Convert to DD-MM-YYYY.
  private millisToDDMMYYYY(ms: number | null): string {
    const n = Number(ms);
    if (n === 0) return 'On Admission';
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }

  // ----- printing helpers (unchanged in your file) -----
  private buildFeeCalcPrintHtml(
    programName: string,
    programCode: string,
    feePlanName: string,
    scholarshipText: string,
    instals: any[],
    finalFee: number,
    pageBreakBefore: boolean,
  ): string {
    const today = new Date();

    const instalRows = instals
      .map(
        (x: any) => `
      <tr>
        <td class="text-center">${x.sno}</td>
        <td>${this.esc(x.dueDate || '')}</td>
        <td class="text-center">${this.esc(x.mode || '')}</td>
        <td>${this.esc(x.feeFor || '-')}</td>
        <td>${this.esc(x.favourOf || '-')}</td>
        <td class="text-right">${Number(x.amount || 0).toLocaleString('en-IN')}</td>
      </tr>
    `,
      )
      .join('');

    const pbStyle = pageBreakBefore ? 'page-break-before: always;' : '';

    return `
    <div class="page" style="${pbStyle}">
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
          <div class="kv-label">Scholarships</div><div>${this.esc(scholarshipText)}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Cheque / Instalment Schedule</div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;" class="text-center">S.No</th>
              <th style="width:110px;">Installment Date</th>
              <th style="width:80px;" class="text-center">Mode</th>
              <th>Fee For</th>
              <th>Favour Of</th>
              <th style="width:140px;" class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${instalRows || `<tr><td colspan="6" class="text-center">No instalments</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5" class="text-right">Total</th>
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
      @media print {
        body { margin: 0; }
        .page { page-break-inside: avoid; }
      }
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
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return s.replace(/[&<>"']/g, (c) => map[c] || c);
  }

  private pickTenantId(): string {
    return (
      (localStorage.getItem('entiId') || '').trim() ||
      (localStorage.getItem('tenantId') || '').trim()
    );
  }

  get alert$() {
    return this.alert.alert$;
  }

  clearAlert(): void {
    this.alert.clear();
  }
}
