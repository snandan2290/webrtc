import { Component, Input, OnInit } from '@angular/core';
import {
    AbstractControl,
    AbstractControlDirective,
    FormControl,
} from '@angular/forms';
import { DataService } from '../../services/data.service';

@Component({
    selector: 'movius-web-ui-slide-dropdown',
    templateUrl: './ui-slide-dropdown.component.html',
    styleUrls: ['./ui-slide-dropdown.component.scss'],
})
export class UiSlideDropdownComponent implements OnInit {
    @Input()
    optionList: string[];
    @Input()
    uiTitle;
    @Input()
    uiTitleEmpty;
    @Input()
    cyAttribute;
    @Input()
    doSlideTitle: boolean = true;
    @Input()
    control: AbstractControlDirective | AbstractControl;
    @Input()
    customValidationMessage: string | { [key: string]: string };

    isPlaceholderVisible: boolean = false;

    constructor(
        readonly dataService: DataService
    ) {}

    ngOnInit(): void {}

    ngAfterViewInit(): void {
         document.querySelector('nz-select input[autocomplete]').setAttribute('autocomplete', 'disabled');
    }
}
