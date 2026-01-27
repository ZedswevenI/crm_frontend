import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'autocomplete',
  standalone: false,
  templateUrl: './autocomplete.component.html',
  styleUrl: './autocomplete.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true
    }
  ]
})
export class AutocompleteComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() placeholder: string = 'Select';
  @Input() required: boolean = false;
  @Input() options: any[] = [];
  @Input() optionLabel: string = 'label';
  @Input() optionValue: string = 'value';
  @Input() control: AbstractControl | null = null;
  @Input() disabled: boolean = false;
  @Input() autofocus: boolean = false;
  @Output() selectionChange = new EventEmitter<any>();
  value: any = '';
  searchText: string = '';
  dropdownOpen = false;
  filteredOptions: any[] = [];
  highlightedIndex: number = -1;
  showNoMatch = false;
  onChange = (_: any) => {};
  onTouched = () => {};

  writeValue(value: any): void {
    this.value = value;
    const match = this.options.find(opt => opt?.[this.optionValue] === value);
    this.searchText = match ? this.getLabel(match) : '';
    this.hideNoMatch();
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  getLabel(opt: any) { return opt?.[this.optionLabel] ?? ''; }

  onInput(event: any) {
    this.searchText = event.target.value ?? '';
    this.filterOptions();
    this.dropdownOpen = true;
  }

  filterOptions() {
    const search = (this.searchText || '').toLowerCase().trim();
    this.filteredOptions = this.options.filter(opt =>
      (this.getLabel(opt) || '').toLowerCase().includes(search)
    );
    this.highlightedIndex = this.filteredOptions.length ? 0 : -1;
    if (search && this.filteredOptions.length === 0) {
      this.value = '';
      this.onChange('');
      this.dropdownOpen = false;
      this.showNoMatch = true;
      return;
    }

    this.hideNoMatch();
  }

  selectOption(opt: any) {
    this.value = opt?.[this.optionValue];
    this.searchText = this.getLabel(opt);
    this.onChange(this.value);
    this.selectionChange.emit(opt);
    this.dropdownOpen = false;
    this.hideNoMatch();
  }

  openDropdown() {
    this.filterOptions();
    this.dropdownOpen = true;
  }

  closeDropdown() {
    setTimeout(() => {
      this.dropdownOpen = false;
      const exact = this.options.find(opt => this.getLabel(opt) === this.searchText);
      if (!exact) {
        this.searchText = '';
        this.value = '';
        this.onChange('');
      }
      this.hideNoMatch();
    }, 150);
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.dropdownOpen || this.filteredOptions.length === 0) return;
    if (event.key === 'ArrowDown') {
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredOptions.length - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (this.highlightedIndex >= 0) {
        this.selectOption(this.filteredOptions[this.highlightedIndex]);
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      this.dropdownOpen = false;
      event.preventDefault();
    }
  }

  private hideNoMatch() {
    this.showNoMatch = false;
  }
}