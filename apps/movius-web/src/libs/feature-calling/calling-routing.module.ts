import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import * as CC from './components';
import { AvoidCompDeactivateGuard } from '../shared/Guards/avoidComponentDestory';

const callingRoutes: Routes = [
    {
        path: '',
        component: CC.CallingWorkspaceComponent,
        children: [
            {
                path: 'call/new',
                pathMatch: 'full',
                component: CC.NewCallWorkspaceComponent,
            },
            {
                path: 'call/:id',
                component: CC.CallWorkspaceComponent,
                canDeactivate:[AvoidCompDeactivateGuard]
            },
            {
                path: 'call/:id/details',
                pathMatch: 'full',
                component: CC.DetailsWorkspaceCallsComponent,
            },
        ],
    },
];

@NgModule({
    imports: [RouterModule.forChild(callingRoutes)],
    exports: [RouterModule],
    providers:[AvoidCompDeactivateGuard]
})
export class CallingRoutingModule {}
