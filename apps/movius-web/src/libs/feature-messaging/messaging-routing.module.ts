import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditContactLayoutComponent } from '../feature-contacts/components';
import * as MC from './components';

const routes: Routes = [
    {
        path: '',
        component: MC.MessagingWorkspaceComponent,
        children: [
            {
                path: 'chat/new',
                pathMatch: 'full',
                component: MC.StartWorkspaceComponent,
            },
            {
                path: 'chat/multiline/:id',
                pathMatch: 'full',
                component: MC.ChatWorkspaceComponent,
            },
            {
                path: 'chat/:id',
                pathMatch: 'full',
                component: MC.ChatWorkspaceComponent,
            },
            {
                path: 'chat/:id/details',
                pathMatch: 'full',
                component: MC.DetailsWorkspaceComponent,
            },
            {
                path: 'chat/:id/participants',
                pathMatch: 'full',
                component: MC.GroupMessageParticipantsComponent,
            },
            {
                path: 'chat/edit/:id',
                pathMatch: 'full',
                component: MC.StartWorkspaceComponent,
            },
            {
                path: 'new/:mlnumber',
                pathMatch: 'full',
                component: EditContactLayoutComponent,
            },
            {
                path: ':id/edit/:mlnumber',
                pathMatch: 'full',
                component: EditContactLayoutComponent,
            },
            {
                path: ':id/edit',
                pathMatch: 'full',
                component: EditContactLayoutComponent,
            },
        ],
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class MessagingRoutingModule {}
