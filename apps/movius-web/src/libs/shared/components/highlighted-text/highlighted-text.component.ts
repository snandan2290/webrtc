import { Component, Input, OnChanges } from "@angular/core";

@Component({
    selector: 'highlighted-text',
    templateUrl: './highlighted-text.component.html',
    styleUrls: ['./highlighted-text.component.scss']
})
export class HighlightedTextComponent implements OnChanges {
    @Input() toFind: string;
    @Input() fullText: string;
    public result: string[];

    ngOnChanges() {
        if (this.toFind === null || this.toFind === undefined)
            return
        const regEx = new RegExp('(' + this.escapeRegExp(this.toFind) + ')', 'i');
        this.result = this.fullText?.split(regEx);
    }

    private escapeRegExp(string) {
        //INFO CB:15Feb2021: $& - the whole matched string
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}