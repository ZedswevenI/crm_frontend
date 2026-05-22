import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-feeplanview',
  standalone: false,
  templateUrl: './feeplanview.component.html',
  styleUrl: './feeplanview.component.scss',
})
export class FeeplanviewComponent implements OnInit {
  entiId: any;
  recId: string = '';
  loading = false;
  doc: any = null;
  totalBaseFee = 0;
  totalGST = 0;
  totalFee = 0;
  private moduleName = 'ims/feeplan';
  showReviseModal = false;
  revisePercent: number = 5;
  reviseAcademicYear = '';
  revisePlanName = '';
  revisePreview: any[] = [];
  reviseTotalOld = 0;
  reviseTotalNew = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.entiId =
      localStorage.getItem('tenantId') || localStorage.getItem('tenantid');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Fee Plans' },
      { label: 'View' },
    ]);
  }

  ngOnInit(): void {
    this.recId = String(this.route.snapshot.paramMap.get('id') || '');
    if (!this.recId) {
      this.alert.error('Invalid fee plan id');
      this.back();
      return;
    }
    this.load();
  }

  get academicYearOptions(): { label: string; value: string }[] {
    const current = new Date().getFullYear();
    return [-1, 0, 1, 2].map((offset) => {
      const start = current + offset;
      const end = start + 1;
      const value = `${start}-${String(end).slice(-2)}`;
      return { label: `${start} - ${end}`, value };
    });
  }

  back() {
    this.router.navigate(['/app/fees/plans']);
  }

  private fmt2(n: any) {
    const num = Number(n || 0);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  money(n: any) {
    return `₹${this.fmt2(n)}`;
  }

  load() {
    this.loading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId: this.recId },
        this.moduleName,
        'view',
      )
      .subscribe({
        next: (res: any) => {
          this.doc = res?.data || null;

          this.totalBaseFee = Number(this.doc?.totalBaseFee || 0);
          this.totalGST = Number(this.doc?.totalGST || 0);
          this.totalFee = Number(this.doc?.totalFee || 0);

          this.loading = false;
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load fee plan');
          this.back();
        },
      });
  }

  badgeClass(status: string) {
    return status === 'Active' ? 'bg-success' : 'bg-secondary';
  }

  feeHeadRowClass(h: any) {
    const key = String(h?.key || '').toUpperCase();
    return key === 'TF' ? 'table-success' : '';
  }

  // instalmentDate: backend now sends number (0 or epoch ms)
  hasInstDate(i: any): boolean {
    const n = Number(i?.instalmentDate || 0);
    return Number.isFinite(n) && n > 0;
  }

  openReviseModal(): void {
    if (!this.doc) return;
    this.revisePercent = 5;
    this.reviseAcademicYear = '';
    this.revisePlanName = `${this.doc.feePlanName}_Revised`;
    this.onRevisePercentChange();
    this.showReviseModal = true;
  }

  closeReviseModal(): void {
    this.showReviseModal = false;
  }

  onRevisePercentChange(): void {
    if (!this.doc?.feeHeads?.length) return;
    const pct = Number(this.revisePercent || 0);
    const multiplier = 1 + pct / 100;

    let oldTotal = 0;
    let newTotal = 0;

    this.revisePreview = (this.doc.feeHeads || []).map((h: any) => {
      const oldBase = Number(h.amount || 0);
      const newBase = Math.round(oldBase * multiplier);
      const gstPct = Number(h.gstPercent || 0);
      const oldGst = Number(h.gstAmount || 0);
      const newGst = Math.round((newBase * gstPct) / 100);
      const oldT = Number(h.totalAmount || 0);
      const newT = newBase + newGst;

      oldTotal += oldT;
      newTotal += newT;

      return {
        key: h.key,
        label: h.label,
        oldBase,
        newBase,
        oldGst,
        newGst,
        oldTotal: oldT,
        newTotal: newT,
        gstPercent: gstPct,
        discountAllowed: h.discountAllowed,
      };
    });

    this.reviseTotalOld = oldTotal;
    this.reviseTotalNew = newTotal;
  }

  proceedRevise(): void {
    if (!this.doc) return;
    const pct = Number(this.revisePercent || 0);
    const multiplier = 1 + pct / 100;
    // const newFeeHeads = (this.doc.feeHeads || []).map((h: any) => {
    //   const newBase = Math.round(Number(h.amount || 0) * multiplier);
    //   const gstPct = Number(h.gstPercent || 0);
    //   const newGst = Math.round((newBase * gstPct) / 100);
    //   return {
    //     ...h,
    //     amount: newBase,
    //     gstAmount: newGst,
    //     totalAmount: newBase + newGst,
    //   };
    // });
    // const newTotalBase = newFeeHeads.reduce(
    //   (s: number, h: any) => s + h.amount,
    //   0,
    // );
    // const newTotalGst = newFeeHeads.reduce(
    //   (s: number, h: any) => s + h.gstAmount,
    //   0,
    // );
    // const newTotalFee = newFeeHeads.reduce(
    //   (s: number, h: any) => s + h.totalAmount,
    //   0,
    // );
    const newFeeHeads = (this.doc.feeHeads || []).map((h: any) => {
      const newBase = Math.round(Number(h.amount || 0) * multiplier);
      const gstPct = Number(h.gstPercent || 0);
      const newGst = Math.round((newBase * gstPct) / 100);
      const newTotal = newBase + newGst;
      return {
        ...h,
        amount: newBase,
        gstAmount: newGst,
        totalAmount: newTotal,
      };
    });
    const newTotalBase = newFeeHeads.reduce(
      (s: number, h: any) => s + Number(h.amount),
      0,
    );
    const newTotalGst = newFeeHeads.reduce(
      (s: number, h: any) => s + Number(h.gstAmount),
      0,
    );
    const newTotalFee = newFeeHeads.reduce(
      (s: number, h: any) => s + Number(h.totalAmount),
      0,
    );
    const oldTotalFee = Number(this.doc.totalFee || 0);
    // const newInstalments = (this.doc.instalments || []).map((i: any) => {
    //   const oldAmt = Number(i.amount || 0);
    //   const newAmt =
    //     oldTotalFee > 0
    //       ? Math.round((oldAmt / oldTotalFee) * newTotalFee)
    //       : oldAmt;
    //   return { ...i, amount: newAmt };
    // });
    // const instSum = newInstalments.reduce(
    //   (s: number, i: any) => s + i.amount,
    //   0,
    // );
    // const diff = newTotalFee - instSum;
    // if (newInstalments.length > 0 && diff !== 0) {
    //   newInstalments[newInstalments.length - 1].amount += diff;
    // }
    const newInstalments = (this.doc.instalments || []).map((i: any) => {
      const oldAmt = Number(i.amount || 0);
      const newAmt =
        oldTotalFee > 0
          ? Math.round((oldAmt / oldTotalFee) * newTotalFee)
          : Math.round(oldAmt * multiplier);
      return { ...i, amount: newAmt };
    });
    const instSum = newInstalments.reduce(
      (s: number, i: any) => s + Number(i.amount),
      0,
    );
    const diff = newTotalFee - instSum;
    if (newInstalments.length > 0 && diff !== 0) {
      newInstalments[newInstalments.length - 1].amount =
        Number(newInstalments[newInstalments.length - 1].amount) + diff;
    }
    this.router.navigate(['/app/fees/plans'], {
      state: {
        prefill: {
          academicYear: this.reviseAcademicYear,
          programCode: this.doc.programCode,
          feePlanName: this.revisePlanName,
          centerCode: this.doc.centerCode || '',
          isActive: true,
          feeHeads: newFeeHeads,
          instalments: newInstalments,
          totalBaseFee: newTotalBase,
          totalGST: newTotalGst,
          totalFee: newTotalFee,
        },
      },
    });
  }
}
