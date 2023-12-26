import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'movius-web-pwd-strength',
    templateUrl: './pwd-strength.component.html',
    styleUrls: ['./pwd-strength.component.scss']
})
export class PwdStrengthComponent implements OnInit {

    readonly totalBlocksCount: number = 9;
    totalBlocks: Array<number>;

    strongPwdThreshold = 0.75;

    _passedValidatorsPct: number;

    @Input()
    set passedValidatorsPct(value: number){
        this._passedValidatorsPct = value;
        this._updateBlocks(value);
    }
    currentBlocksCount: number;

    constructor() { }

    ngOnInit(): void {
        this.currentBlocksCount = 0;
        this.totalBlocks = new Array(this.totalBlocksCount).map((_,i)=>i);
    }

    private _updateBlocks(value: number){
        const blockCount = Math.ceil(this.totalBlocksCount * value);
        this.currentBlocksCount = blockCount;
    }
}
