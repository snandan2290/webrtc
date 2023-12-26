import { Directionality } from '@angular/cdk/bidi';
import { Overlay } from '@angular/cdk/overlay';
import { Injectable, Injector } from '@angular/core';
import { NzConfigService } from 'ng-zorro-antd/core/config';
import { NzSafeAny } from 'ng-zorro-antd/core/types';
import { ModalOptions, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';

@Injectable({
    providedIn: 'root',
})
export class CustomNzModalService extends NzModalService {

    public closeModalPassingData:any;
    public ModalStatus:any;
    public noOfCallsReceived:any;
    
    constructor(overlay: Overlay, injector: Injector, nzConfigService: NzConfigService, parentModal: NzModalService, directionality: Directionality,) {
        super(
            arguments[0],
            arguments[1],
            arguments[2],
            arguments[3],
            arguments[4]
        );
    }

    create<T, R = NzSafeAny>(config: ModalOptions<T, R>): NzModalRef<T, R> {
        const res = super.create(config);
        res.afterClose.subscribe((e) => {
            this.processClose();
        })

        this.processOpen();

        return res;
    }

    private processOpen = () => {
        setTimeout(() => {
            let res = document.querySelector('.cdk-overlay-container');
            res?.classList?.add('allow-pointer-events');
        }, 0)
    }

    private processClose = () => {
        setTimeout(() => {
            let res = document.querySelector('.cdk-overlay-container');
            res?.classList?.remove('allow-pointer-events');
        }, 0)
    }

}
