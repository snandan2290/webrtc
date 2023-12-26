import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MMSService {

 isImageTypeGif = new Subject<boolean>();
 
  constructor() { }

   public previewImageCancelStatus =  new BehaviorSubject(false);

    updatePreviewImageCancelStatus(status:boolean) {
        this.previewImageCancelStatus.next(status)
    }
}
