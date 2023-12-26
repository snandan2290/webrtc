import { Injectable } from "@angular/core";
import { Observable, BehaviorSubject, Subject } from "rxjs";

@Injectable({
    providedIn: "root"
})
export class AudioService {
  playingAudioId = '';
  pause$:Observable<any>
  audioId:string='';


  private pauseAudioId: BehaviorSubject<string> = new BehaviorSubject('');

  public get pauseAudioData(): Observable<string>{
    return this.pauseAudioId.asObservable();
  }

  constructor() { }

  pauseAllAudio(id){
    this.pauseAudioId.next(id)
  }
}