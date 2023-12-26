import {
    Component,
    Input,
    OnInit,
    Output,
    EventEmitter,
    ViewChild,
    ElementRef,
} from '@angular/core';

@Component({
    selector: 'movius-web-phone-keyboard',
    templateUrl: './phone-keyboard.component.html',
    styleUrls: ['./phone-keyboard.component.scss'],
})
export class PhoneKeyboardComponent implements OnInit {
    @Input()
    isSimple = false;

    @Output()
    clicked = new EventEmitter<string>();

    @Output()
    voiceMail = new EventEmitter();

    @ViewChild('soundDTFMF') soundDTFMF: ElementRef<HTMLAudioElement>;

    private audioCtx: AudioContext;

    constructor() {
        //BUG: CB:16Aug2021: Safari audio-play delay issue:
        //BUG: CB:16Aug2021: Info: https://stackoverflow.com/questions/9811429/html5-audio-tag-on-safari-has-a-delay
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContext();
    }

    ngOnInit(): void {}

    async passValue(val: string) {
        await this.soundDTFMF.nativeElement.play();
        //this.soundDTFMF.nativeElement.pause();
        this.soundDTFMF.nativeElement.muted = false;
        this.clicked.emit(val);
    }

    onVoiceMail() {
        this.voiceMail.emit();
    }
}
