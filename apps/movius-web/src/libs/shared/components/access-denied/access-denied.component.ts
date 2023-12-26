import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'movius-web-access-denied',
    templateUrl: './access-denied.component.html',
    styleUrls: ['./access-denied.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedContainer {
    html: string;
    abc: number;

    constructor(activatedRoute: ActivatedRoute) {
        this.html = activatedRoute.snapshot.data.html;
    }

}
