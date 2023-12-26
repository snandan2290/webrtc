import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { combineLatest, Observable } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { selectContactGhosts, startAddToExistentContact, UserContactGhost } from '../../../feature-contacts';
import { selectCallingContactGhosts } from '../../ngrx';

export interface DetailsWorkspaceCallsView {
    ghost: UserContactGhost;
}

@Component({
  selector: 'movius-web-details-workspace-calls',
  templateUrl: './details-workspace-calls.component.html',
  styleUrls: ['./details-workspace-calls.component.scss']
})
export class DetailsWorkspaceCallsComponent implements OnInit {

    readonly view$: Observable<DetailsWorkspaceCallsView>;
    readonly peers$: Observable<UserContactGhost[]>;

    constructor(
        private readonly router: Router,
        activatedRouter: ActivatedRoute,
        private readonly store: Store,
        sipService: SipService
    ) {

        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));

        const id$ = activatedRouter.params.pipe(map(({ id }) => id));
        const userContactGhosts$ = id$.pipe(
            switchMap((id) =>
                store
                    .select(selectCallingContactGhosts(sipService.getUserUri))
                    .pipe(map((ghosts) => ghosts.find((f) => f.id === id)))
            ),
            filter((f) => !!f)
        );
        this.view$ = combineLatest([
            userContactGhosts$,
        ]).pipe(
            map(([userContactGhost]) => {
                return {
                    ghost: userContactGhost,
                };
            })
        );
    }

    ngOnInit(): void {}

    onCreateContact(peerId: string) {
        this.router.navigate(['contacts', 'new', peerId]);
    }

    onAddToContact(peerId: string) {
        this.store.dispatch(startAddToExistentContact({ mlNumber: peerId }));
    }
}
