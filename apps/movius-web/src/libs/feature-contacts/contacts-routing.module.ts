import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
    ContactInformationComponent,
    ContactsWorkspaceComponent,
    EditContactLayoutComponent,
    SyncContactsComponent,
} from './components';

const routes: Routes = [
    {
        path: 'sync',
        component: SyncContactsComponent,
    },
    {
        path: '',
        component: ContactsWorkspaceComponent,
        children: [
            {
                path: 'add',
                pathMatch: 'full',
                component: EditContactLayoutComponent,
            },
            {
                path: 'new/:mlnumber',
                component: EditContactLayoutComponent,
            },
            {
                path: ':id/edit',
                component: EditContactLayoutComponent,
            },
            {
                path: ':id/edit/:mlnumber',
                component: EditContactLayoutComponent,
            },
            {
                path: ':id',
                pathMatch: 'full',
                component: ContactInformationComponent,
            },
        ],
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class ContactsRoutingModule {}
