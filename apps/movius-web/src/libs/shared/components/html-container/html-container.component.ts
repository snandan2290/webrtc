import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'movius-web-html-container',
    templateUrl: './html-container.component.html',
    styleUrls: ['./html-container.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlContainer {
    html: string;

    constructor(activatedRoute: ActivatedRoute) {
        this.html = activatedRoute.snapshot.data.html;
    }
}
