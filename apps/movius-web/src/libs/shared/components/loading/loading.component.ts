import { Component, OnInit } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { AuthDataAccessService } from '../../services/auth.data-access.service';

@Component({
  selector: 'movius-web-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent implements OnInit  {
  width = window.innerWidth;
  height = window.innerHeight;

  constructor(private authService:AuthDataAccessService,private readonly _modal: NzModalRef,) {
    this.authService.LoadingSpinnerData.subscribe(data => {
      if(!data){
        this._modal.close(data);
      }
    })
   }

  ngOnInit(): void {
  }

  modalClose(modalStatus:boolean){
    this._modal.close(modalStatus);
  }

  GetTheme() {
    let theme = localStorage.getItem("Theme")
    return theme ? "Dark" : null
  }

}
