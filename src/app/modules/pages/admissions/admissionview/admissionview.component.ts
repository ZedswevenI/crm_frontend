import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

type ChequeMode = 'PDC' | 'CDC';
type ChequeStatus = 'pending' | 'deposited' | 'cleared' | 'bounced' | 'cancelled';
type AdmissionStatus = 'draft' | 'submitted' | 'confirmed' | 'cancelled';

interface FeeHeadRow {
  key: string; // e.g., 'tuition'
  label: string; // 'Tuition Fee'
  fee: number;
  stax: number;
}

interface NefRef {
  utrNo: string;
  amount: number;
  paidOn?: string | null;
  remarks?: string | null;
}

interface ChequeRow {
  sno: number;
  chequeDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  favourOf: string;
  amount: number;
  chequeNo: string;
  mode: ChequeMode;
  status: ChequeStatus;
  remarks?: string | null;
}

interface AdmissionViewModel {
  admissionId: string;
  status: AdmissionStatus;

  createdAt: string;
  updatedAt?: string;

  student: {
    name: string;
    regNo?: string | null;
    phone: string;
    parentName: string;
    parentPhone: string;
    email?: string | null;
  };

  academics: {
    centreName: string;
    programName: string;
    batchName?: string | null;
    className?: string | null;
  };

  test: {
    testDate?: string | null;
    testName?: string | null;
    score?: number | null;
    percentile?: number | null;
    result?: 'pass' | 'fail' | 'pending' | null;
    remarks?: string | null;
  };

  fee: {
    feePlanCode: string; // like 9020
    feePlanName: string; // like "Base Fee Plan"
    baseTotal: number;
    discountPctTotal: number; // (test + scholarship + additional)
    discountOnlyOn: 'tuition';
    feeHeads: FeeHeadRow[];
  };

  payments: {
    neftSplitAmount: number;
    neftRefs: NefRef[];
    cheques: ChequeRow[];
  };
}

@Component({
  selector: 'app-admissionview',
  standalone: false,
  templateUrl: './admissionview.component.html',
  styleUrl: './admissionview.component.scss'
})
export class AdmissionviewComponent implements OnInit {
  admissionId = '';
  loading = true;

  // Replace this with API response later
  admission!: AdmissionViewModel;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.admissionId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    if (!this.admissionId) {
      this.router.navigate(['/app/admissions']);
      return;
    }

    // TODO: Call API here. For now dummy.
    this.loadDummy();
  }

  // ---------- computed for Fee Head table ----------
  get feeHeadPreview(): Array<{ label: string; fee: number; stax: number; total: number; scholBenefits: number }> {
    const pct = Number(this.admission?.fee?.discountPctTotal || 0);
    const heads = this.admission?.fee?.feeHeads || [];
    if (!heads.length) return [];

    return heads.map((h) => {
      const fee = Number(h.fee || 0);
      const stax = Number(h.stax || 0);

      let outFee = fee;
      let outStax = stax;
      let schol = 0;

      if (h.key === 'tuition' && pct > 0) {
        const rate = fee > 0 ? stax / fee : 0;
        outFee = Math.round(fee * (1 - pct / 100));
        outStax = Math.round(outFee * rate);
        const before = fee + stax;
        const after = outFee + outStax;
        schol = Math.max(0, before - after);
      }

      return {
        label: h.label,
        fee: outFee,
        stax: outStax,
        total: outFee + outStax,
        scholBenefits: schol
      };
    });
  }

  get finalFee(): number {
    return this.feeHeadPreview.reduce((s, r) => s + (Number(r.total || 0)), 0);
  }

  get chequeCount(): number {
    return this.admission?.payments?.cheques?.length || 0;
  }

  get chequeTotal(): number {
    return (this.admission?.payments?.cheques || []).reduce((s, c) => s + (Number(c.amount || 0)), 0);
  }

  get neftTotal(): number {
    return (this.admission?.payments?.neftRefs || []).reduce((s, n) => s + (Number(n.amount || 0)), 0);
  }

  // ---------- print actions (hook points) ----------
  printFeeAcknowledgement(): void {
    // TODO: integrate your print module / PDF generation
    console.log('print fee acknowledgement', this.admissionId);
    window.print(); // placeholder
  }

  printContract(): void {
    console.log('print contract', this.admissionId);
    window.print(); // placeholder
  }

  printFeeCalculation(): void {
    console.log('print fee calculation', this.admissionId);
    window.print(); // placeholder
  }

  goBack(): void {
    this.router.navigate(['/app/admissions']);
  }

  private loadDummy(): void {
    setTimeout(() => {
      this.admission = {
        admissionId: this.admissionId,
        status: 'confirmed',
        createdAt: '2025-09-28',
        updatedAt: '2025-09-29',

        student: {
          name: 'Student Name',
          regNo: '9001111012809250093',
          phone: '9000000000',
          parentName: 'Parent Name',
          parentPhone: '9888888888',
          email: 'student@email.com'
        },

        academics: {
          centreName: 'Coimbatore',
          programName: 'Aspire - Four Year Integrated School Program',
          batchName: 'Batch A - 2025',
          className: 'Class XI - Evening'
        },

        test: {
          testDate: '2025-09-28',
          testName: 'Admission Test 1',
          score: 72,
          percentile: 84,
          result: 'pass',
          remarks: 'Good performance'
        },

        fee: {
          feePlanCode: '9020',
          feePlanName: 'Base Fee Plan',
          baseTotal: 520076,
          discountPctTotal: 50, // combined discount %
          discountOnlyOn: 'tuition',
          feeHeads: [
            { key: 'admission', label: 'Admission Fee', fee: 118050, stax: 21249 },
            { key: 'admin', label: 'Administrative Charges', fee: 78700, stax: 14166 },
            { key: 'study', label: 'Study Material Price', fee: 84000, stax: 15120 },
            { key: 'exam', label: 'Examination Fee', fee: 22000, stax: 3960 },
            { key: 'cbt', label: 'CBT Support Charges', fee: 2500, stax: 450 },
            { key: 'tuition', label: 'Tuition Fee', fee: 135492, stax: 24389 }
          ]
        },

        payments: {
          neftSplitAmount: 120000,
          neftRefs: [
            { utrNo: 'UTR123456', amount: 50000, paidOn: '2025-09-29', remarks: 'Part payment' },
            { utrNo: 'UTR987654', amount: 70000, paidOn: '2025-09-29', remarks: '' }
          ],
          cheques: [
            {
              sno: 1,
              chequeDate: '2025-09-29',
              dueDate: '2025-10-10',
              favourOf: 'ZEDSWEVEN I PRIVATE LIMITED',
              amount: 55720,
              chequeNo: '001234',
              mode: 'PDC',
              status: 'pending',
              remarks: ''
            },
            {
              sno: 2,
              chequeDate: '2025-09-29',
              dueDate: '2025-11-10',
              favourOf: 'ZEDSWEVEN I PRIVATE LIMITED',
              amount: 55720,
              chequeNo: '001235',
              mode: 'PDC',
              status: 'cleared',
              remarks: 'Cleared on time'
            }
          ]
        }
      };

      this.loading = false;
    }, 200);
  }
}
