import { Component, Input, OnInit } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { AuthDataAccessService } from '../../services/auth.data-access.service';

@Component({
  selector: 'movius-web-teams-error-display',
  templateUrl: './teams-error-display.component.html',
  styleUrls: ['./teams-error-display.component.scss']
})
export class TeamsErrorDisplayComponent implements OnInit  {
    showMore = false;
    @Input() errorTeamsText: string;

  constructor ( 
      private authService:AuthDataAccessService,
      private readonly _modal: NzModalRef,
      ) {
   }

  ngOnInit(): void {}

  modalClose(modalStatus:boolean){
    this._modal.close(modalStatus);
  }

  GetTheme(){
    let theme = localStorage.getItem("Theme")
    return theme ? "Dark" : null
  }

}
