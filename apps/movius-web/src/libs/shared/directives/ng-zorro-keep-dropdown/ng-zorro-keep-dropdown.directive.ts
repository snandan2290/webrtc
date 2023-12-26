import { Directive } from '@angular/core';

//BUG CB:18Mar2021: Ng-zorro scrolling of modals' bug - pointer-events:none restriction.
// .cdk-overlay-container {
//     pointer-events: auto;
//     &:empty {
//         pointer-events: none;
//     }
// }

// .no-allow-events {
//     pointer-eventmoviusWebNgZorroKeepDropdowns: none;
// }
//BUG CB:18Mar2021: Ng-zorro scrolling of modals' bug - pointer-events:none restriction.

//CB: 19May2021: Obsolete directive. Consider removal.
@Directive({
    selector: '[moviusWebNgZorroKeepDropdown]',
    host: {
        '(mouseenter)': 'onMouseEnter()',
        '(mouseleave)': 'onMouseLeave()'
    }
})
export class NgZorroKeepDropdownDirective {

    //INFO: 22Mar2021: This directive fixes the ng-zorro dropdown behavior: dropdown is hidden right after open...
    //INFO: 22Mar2021: ... because mouse event goes through updated - due to modals-scroll issue - .cdk-overlay-container layer.
    //INFO: 22Mar2021: Necessity of this action is caused by the change of how ng-zorro handles...
    //INFO: 22Mar2021: ... pointer events of its top .cdk-overlay-container layer.
    constructor() { }

    onMouseEnter() {
        setTimeout(() => {
            let res = document.querySelector('.cdk-overlay-container');
            res?.classList?.add('no-allow-events');
        }, 0)
    }

    onMouseLeave() {
        setTimeout(() => {
            let res = document.querySelector('.cdk-overlay-container');
            res?.classList?.remove('no-allow-events');
        }, 0)
    }

}
