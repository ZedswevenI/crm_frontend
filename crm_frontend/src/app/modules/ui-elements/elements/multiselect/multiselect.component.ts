import { Component, Input, forwardRef, Output, EventEmitter } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'multiselect',
  standalone: false,
  templateUrl: './multiselect.component.html',
  styleUrl: './multiselect.component.scss',
    providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiselectComponent),
      multi: true
    }
  ]
})
export class MultiselectComponent implements ControlValueAccessor {
    @Input() label: string = '';
  @Input() placeholder: string = 'Select';
  @Input() required: boolean = false;
  @Input() options: any[] = [];
  @Input() optionLabel: string = 'label';
  @Input() optionValue: string = 'value';
  @Input() control: AbstractControl | null = null;
  @Output() selectionChange = new EventEmitter<any>();

  selectedItems: any[] = [];
  value: any = [];
  onChange = (_: any) => {};
  onTouched = () => {};

  writeValue(value: any): void {
    if (value) {
      this.selectedItems = value;
      this.value = value;
    } else {
      this.selectedItems = [];
      this.value = [];
    }
  }

  getSelectedLabels(): string {
  return this.selectedItems.map(item => item[this.optionLabel]).join(', ');
}
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  toggleSelection(option: any) {
    const index = this.selectedItems.indexOf(option);
    if (index === -1) {
      this.selectedItems.push(option);
    } else {
      this.selectedItems.splice(index, 1);
    }
    this.value = [...this.selectedItems];
    this.onChange(this.value);
    this.selectionChange.emit(this.value);
  }

  isSelected(option: any) {
    return this.selectedItems.includes(option);
  }
}
