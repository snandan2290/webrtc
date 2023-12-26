import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SipService, SIP_CONFIG } from './sip.service';
import { SipConfig } from './models';
import { MockSipService } from './mock-sip.service';

@NgModule({
    imports: [CommonModule],
    providers: [
        {
            provide: SipService,
            useClass: window['Cypress'] ? MockSipService : SipService,
        },
    ],
})
export class SipModule {
    static forRoot(config: SipConfig): ModuleWithProviders<SipModule> {
        return {
            ngModule: SipModule,
            providers: [
                {
                    provide: SIP_CONFIG,
                    useValue: config,
                },
            ],
        };
    }
}
