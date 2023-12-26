import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AuthDataAccessService } from '../../../shared/services/auth.data-access.service';

export type Coordinates = {
    x: number;
    y: number;
};
@Component({
    selector: 'movius-web-auth',
    templateUrl: './auth.component.html',
    styleUrls: ['./auth.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthComponent implements OnInit {
    width = window.innerWidth;
    height = window.innerHeight;
    isViaTeamsMobile: boolean;

    constructor(private authService:AuthDataAccessService) {
        this.authService.isViaTeamsMobileObs.subscribe(data => {
              this.isViaTeamsMobile = data;
          })
    }

    ngOnInit(): void {}

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }
}
