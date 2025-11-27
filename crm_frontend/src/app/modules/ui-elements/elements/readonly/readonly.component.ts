// readonly.component.ts
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'appreadonly',
  standalone: false,
  templateUrl: './readonly.component.html',
  styleUrls: ['./readonly.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ReadonlyComponent),
      multi: true
    }
  ]
})
export class ReadonlyComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() id?: string;
  @Input() placeholder?: string;
  @Input() required = false;
  @Input() type: string = 'text';

  /** To map _id → name */
  @Input() options: any[] = [];
  @Input() optionLabel: string = '';
  @Input() optionValue: string = '_id';
  @Input() control!: AbstractControl | null;
  private rawValue: any = null;

  displayValue = '';

  disabled = false;

  writeValue(obj: any): void {
    this.rawValue = obj;
    this.updateDisplayValue();
  }

  registerOnChange(_: any): void {}
  registerOnTouched(_: any): void {}

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  private updateDisplayValue() {
    if (this.options && this.options.length && this.rawValue != null) {
      const match = this.options.find((o) => o[this.optionValue] == this.rawValue);
      this.displayValue = match ? match[this.optionLabel] : String(this.rawValue);
    } else {
      this.displayValue = this.rawValue == null ? '' : String(this.rawValue);
    }
  }
}
