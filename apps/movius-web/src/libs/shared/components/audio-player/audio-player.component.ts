import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { StreamState } from "./stream.state";
import { ConfirmDialogComponent } from '..';
import { NzModalService } from 'ng-zorro-antd/modal';
import { MessageBase } from '@movius/domain';

import { MessagingDataAccessService } from '../../../../libs/feature-messaging/services/messaging.data-access.service'
import { Observable, BehaviorSubject, Subject } from "rxjs";
import * as moment from "moment";
import { takeUntil } from 'rxjs/operators';
import { AudioService } from './audio.service'
import { NavigationEnd, Router } from '@angular/router';
import { DataService } from '../../services';
import { MessagingService } from '../../../feature-messaging';
import { VoicemailType } from 'libs/domain/src/lib/models/messageInfo';
import { convertBinaryToBlob } from '../../utils/common-utils';
import { Store } from '@ngrx/store';
import { CallingStatus, selectCallingStatus } from '../..';


@Component({
  selector: 'movius-web-audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.scss']
})
export class AudioPlayerComponent implements OnInit {

  private stop$ = new Subject();
  private audioObj = new Audio();

  @Input() message: VoicemailType;

  @Output() playEvent = new EventEmitter<any>();
  @Output() pauseEvent = new EventEmitter<any>();

  audioSource: string = "";
  readStatus: boolean;

  state: StreamState = {
    playing: false,
    readableCurrentTime: '00:00',
    readableDuration: '',
    duration: undefined,
    currentTime: undefined,
    canplay: false,
    error: false,
    volume: 5,
    pause: false
  };

  audioVol: number = 5;
  isPlayed: boolean = false
  totalDuration: string = "00:00"
  showToggleSpinner: boolean = false;
  callingStatus_tmp: CallingStatus;
  getConnectionErrorValue: any;


  constructor(
    private cdRef: ChangeDetectorRef,
    private modalService: NzModalService,
    private messagingDataAccessService: MessagingDataAccessService,
    private audioService: AudioService,
    router: Router,
    private readonly store: Store,
  ) {
    const callingStatus$ = store.select(selectCallingStatus);
    callingStatus$.subscribe(res => {
      this.callingStatus_tmp = res;
    });
    router.events.subscribe((val) => {
      if (val instanceof NavigationEnd) {
        this.pauseAudio()
      }
    });
    this.messagingDataAccessService.checkVVMStatus.subscribe(data => {
      if (data == true) {
        this.pauseAudio()
      }
    })
  }

  ngOnChanges() {
    this.readStatus = this.message.isVoiceMailRead || false;
  }

  ngOnInit(): void {
    this.audioService.pauseAudioData.subscribe(data => {
      if (data !== this.message.id) {
        this.pauseAudio()
      }
    })
    this.readStatus = this.message.isVoiceMailRead || false;
    this.totalDuration = this.convertDuration(this.message.duration);
    this.state.duration = parseInt(this.message.duration);
  }

  convertDataURIToBinary(dataURI) {
    let BASE64_MARKER = ';base64,';
    let base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    let base64 = dataURI.substring(base64Index);
    let raw = window.atob(base64);
    let rawLength = raw.length;
    let array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  }

  pauseAudio() {
    this.showToggleSpinner = false;
    this.pause();
  }

  async playAudio() {
    this.showToggleSpinner = true;
    this.audioService.pauseAllAudio(this.message.id);
    if (!this.isPlayed) {
      await this.loadSingleVoiceMail();
    } else {
      this.play();
    }
  }

  stopAudio() {
    this.stop()
  }

  onSliderChangeEnd(change) {
    this.seekTo(change.value);
  }

  loadSingleVoiceMail() {
    const voicemailId = this.message.id;
    this.messagingDataAccessService.getVoiceMailData(voicemailId).subscribe(data => {
      const audioData = data.root.vvm
      if (audioData === "") {
        this.showToggleSpinner = false;
        this.noVoicemailAvailPopUp()
      } else {
        const audioType = 'audio/mp3'
        const blobUrl = URL.createObjectURL(convertBinaryToBlob(audioData.AudioBinary, audioType))
        this.audioSource = blobUrl;
        this.playVoicemailStream(blobUrl)
        this.isPlayed = true;
      }
    })
  }

  // // Future use for the Delete voicemail

  // // deleteAudio() {
  // //   this.modalService.create({
  // //     nzContent: ConfirmDialogComponent,
  // //     nzComponentParams: {
  // //       titleTxt: 'Delete Voicemail',
  // //       subTitleTxt: 'Are you sure you want to delete this voicemail from thread.?',
  // //       cancelBtnTxt: 'No',
  // //       applyBtnTxt: 'Yes',
  // //       onOkAction: () => {

  // //       },
  // //     },
  // //     nzBodyStyle: {
  // //       width: '26rem',
  // //     },
  // //     nzWidth: '26rem',
  // //     nzFooter: null,
  // //   });
  // // }

  noVoicemailAvailPopUp() {
    this.modalService.create({
      nzContent: ConfirmDialogComponent,
      nzComponentParams: {
        titleTxt: 'Error',
        subTitleTxt: 'This voicemail is no longer available',
        applyBtnTxt: 'Ok',
      },
      nzBodyStyle: {
        width: '26rem',
      },
      nzWidth: '26rem',
      nzFooter: null,
      nzKeyboard: false,
    });
  }

  playVoicemailStream(url) {
    this.playStream(url).subscribe(events => {
      this.cdRef.detectChanges();
    });
  }

  private convertDuration(duration: any) {
    if (duration >= 60) {
      let minstr = ""
      let secstr = ""
      minstr = Math.floor(duration % 3600 / 60).toString().padStart(2, '0')
      secstr = Math.floor(duration % 60).toString().padStart(2, '0');
      return minstr + ":" + secstr
    } else {
      if (duration < 10) {
        duration = "0" + duration
      }
      return "00:" + duration
    }
  }

  //service methods
  audioEvents = [
    "ended",
    "error",
    "play",
    "playing",
    "pause",
    "timeupdate",
    "canplay",
    "loadedmetadata",
    "loadstart"
  ];

  private stateChange: BehaviorSubject<StreamState> = new BehaviorSubject(
    this.state
  );

  public resetState() {
    this.state = {
      playing: false,
      readableCurrentTime: '',
      readableDuration: '',
      duration: undefined,
      currentTime: undefined,
      canplay: false,
      error: false,
      volume: 5,
      pause: false,
    };
    this.isPlayed = false;
  }

  getState(): Observable<StreamState> {
    return this.stateChange.asObservable();
  }

  private async updateStateEvents(event: Event): Promise<void> {
    switch (event.type) {
      case "canplay":
        this.state.duration = this.audioObj.duration;
        this.state.readableDuration = this.formatTime(this.state.duration);
        this.state.canplay = true;
        this.showToggleSpinner = false
        break;
      case "playing":
        this.state.playing = true;
        break;
      case "pause":
        this.state.playing = false;
        break;
      case "ended":
        this.showToggleSpinner = false;
        this.state.readableCurrentTime = this.totalDuration;
        break;
      case "timeupdate":
        this.state.currentTime = this.audioObj.currentTime;
        this.state.readableCurrentTime = this.formatTime(
          this.state.currentTime
        );
        //update read status
        if (this.state.duration > 4 && !this.readStatus) {
          if (this.state.currentTime > 4) {
            this.readStatus = true
            // this.messagingDataAccessService.updateVoicMailMessageReadStatus(this.message);
            await this.messagingDataAccessService.updateVoicMailMessageReadStatus(this.message.id);
            await this.messagingDataAccessService.updateVoicemailReadStatusInStore(this.message)
            this.messagingDataAccessService.setReadStatusApi(this.message['id']).subscribe(data => {
              return data;
            })
          }
        } else {
          if (this.state.duration <= 4 && this.state.duration == this.state.currentTime) {
            this.readStatus = true
            // this.messagingDataAccessService.updateVoicMailMessageReadStatus(this.message);
            await this.messagingDataAccessService.updateVoicMailMessageReadStatus(this.message.id);
            await this.messagingDataAccessService.updateVoicemailReadStatusInStore(this.message)
            this.messagingDataAccessService.setReadStatusApi(this.message['id']).subscribe(data => {
              return data;
            })
          }
        }
        break;
      case "error":
        this.resetState();
        this.state.error = true;
        break;
    }
    this.stateChange.next(this.state);
  }

  private streamObservable(url) {
    return new Observable(observer => {
      // Play audio
      this.audioObj.src = url;
      this.audioObj.load();
      this.audioObj.play();

      const handler = (event: Event) => {
        this.updateStateEvents(event);
        observer.next(event);
      };

      this.addEvents(this.audioObj, this.audioEvents, handler);
      return () => {
        // Stop Playing
        this.audioObj.pause();
        this.audioObj.currentTime = 0;
        // remove event listeners
        this.removeEvents(this.audioObj, this.audioEvents, handler);
        // reset state
        this.resetState();
      };
    });
  }

  private addEvents(obj, events, handler) {
    events.forEach(event => {
      obj.addEventListener(event, handler);
    });
  }

  private removeEvents(obj, events, handler) {
    events.forEach(event => {
      obj.removeEventListener(event, handler);
    });
  }


  playStream(url) {
    return this.streamObservable(url).pipe(takeUntil(this.stop$));
  }

  play() {
    this.audioObj.play();
  }

  pause() {
    this.audioObj.pause();
  }

  stop() {
    this.stop$.next();
  }

  seekTo(seconds) {
    this.audioObj.currentTime = seconds;
    this.state.readableCurrentTime = this.convertDuration(seconds)
  }

  formatTime(time: number, format: string = "mm:ss") {
    const momentTime = time * 1000;
    return moment.utc(momentTime).format(format);
  }

  public getConnectionError(event: any) {
    this.getConnectionErrorValue = event;
  }

  get disablePlayButton() {
    if (this.callingStatus_tmp === 'another-active-call') {
      return 'another-active-call'
    } else if (this.getConnectionErrorValue === true) {
      return 'network-error'
    } else {
      return null;
    }
  }
}
