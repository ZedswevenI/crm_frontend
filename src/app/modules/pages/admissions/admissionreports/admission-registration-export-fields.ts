import { ExportFieldGroup } from '../../../ui-elements/elements/export-field-picker/export-field-picker.component';

// Mirrors the field list accepted by POST /api/crm/reports/admission/registration
// (ScholarshipTest records — all top-level, no dotted paths on this endpoint).
export const REGISTRATION_EXPORT_FIELD_GROUPS: ExportFieldGroup[] = [
  {
    title: 'Candidate',
    fields: [
      { key: 'registrationNumber', label: 'Registration Number', locked: true },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobileNo', label: 'Mobile No' },
      { key: 'city', label: 'City' },
    ],
  },
  {
    title: 'Test',
    fields: [
      { key: 'testDate', label: 'Test Date' },
      { key: 'testCity', label: 'Test City' },
      { key: 'testCentre', label: 'Test Centre' },
      { key: 'testName', label: 'Test Name' },
      { key: 'centerCode', label: 'Center Code' },
      { key: 'programCode', label: 'Program Code' },
    ],
  },
  {
    title: 'Result',
    fields: [
      { key: 'programOffered1', label: 'Program Offered 1' },
      { key: 'programOffered2', label: 'Program Offered 2' },
      { key: 'testResultStatus', label: 'Result Status' },
      { key: 'paper1Total', label: 'Paper 1 Total' },
      { key: 'paper2Total', label: 'Paper 2 Total' },
      { key: 'gtotal', label: 'Grand Total' },
      { key: 'normalizedScore', label: 'Normalized Score' },
      { key: 'normalizedPercentage', label: 'Normalized %' },
      { key: 'normalizedRank', label: 'Normalized Rank' },
      { key: 'waiverPerInTf', label: 'Waiver % in TF' },
      { key: 'studyCentre', label: 'Study Centre' },
    ],
  },
];
