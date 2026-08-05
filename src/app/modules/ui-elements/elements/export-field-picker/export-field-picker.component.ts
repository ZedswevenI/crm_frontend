import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

export interface ExportFieldOption {
  key: string;
  label: string;
  /** Always exported, can't be unchecked (e.g. a field the backend always returns). */
  locked?: boolean;
}

export interface ExportFieldGroup {
  title: string;
  fields: ExportFieldOption[];
}

@Component({
  selector: 'export-field-picker',
  standalone: false,
  templateUrl: './export-field-picker.component.html',
  styleUrl: './export-field-picker.component.scss',
})
export class ExportFieldPickerComponent implements OnChanges {
  @Input() visible = false;
  @Input() title = 'Export to Excel';
  @Input() groups: ExportFieldGroup[] = [];
  @Input() exporting = false;

  @Output() closed = new EventEmitter<void>();
  @Output() exportClick = new EventEmitter<string[]>();

  private selected = new Set<string>();
  private wasVisible = false;

  ngOnChanges(): void {
    // On the closed→open transition, start with only the locked fields
    // checked — the user picks the rest themselves, nothing is
    // pre-selected on their behalf.
    if (this.visible && !this.wasVisible) {
      this.selected.clear();
      this.groups.forEach((g) =>
        g.fields.forEach((f) => {
          if (f.locked) this.selected.add(f.key);
        }),
      );
    }
    this.wasVisible = this.visible;
  }

  isChecked(key: string): boolean {
    return this.selected.has(key);
  }

  isLocked(group: ExportFieldGroup, key: string): boolean {
    return !!group.fields.find((f) => f.key === key)?.locked;
  }

  toggleField(field: ExportFieldOption): void {
    if (field.locked) return;
    if (this.selected.has(field.key)) {
      this.selected.delete(field.key);
    } else {
      this.selected.add(field.key);
    }
  }

  isGroupFullyChecked(group: ExportFieldGroup): boolean {
    return group.fields.every((f) => this.selected.has(f.key));
  }

  isGroupPartiallyChecked(group: ExportFieldGroup): boolean {
    const some = group.fields.some((f) => this.selected.has(f.key));
    return some && !this.isGroupFullyChecked(group);
  }

  toggleGroup(group: ExportFieldGroup): void {
    const shouldCheck = !this.isGroupFullyChecked(group);
    group.fields.forEach((f) => {
      if (f.locked) return;
      if (shouldCheck) {
        this.selected.add(f.key);
      } else {
        this.selected.delete(f.key);
      }
    });
  }

  selectAll(): void {
    this.groups.forEach((g) => g.fields.forEach((f) => this.selected.add(f.key)));
  }

  clearAll(): void {
    this.selected.clear();
    // Locked fields can never be deselected.
    this.groups.forEach((g) =>
      g.fields.forEach((f) => {
        if (f.locked) this.selected.add(f.key);
      }),
    );
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  close(): void {
    this.closed.emit();
  }

  confirmExport(): void {
    if (!this.selected.size) return;
    this.exportClick.emit(Array.from(this.selected));
  }
}
