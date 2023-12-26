import { Component, Input, OnInit } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
    NzUploadChangeParam,
    NzUploadFile,
    NzUploadXHRArgs
} from 'ng-zorro-antd/upload';
import { BehaviorSubject } from 'rxjs';

// https://stackblitz.com/edit/ph5jmd--run?file=src/app/app.component.ts

@Component({
    selector: 'movius-web-add-photo',
    templateUrl: './add-photo.component.html',
    styleUrls: ['./add-photo.component.scss'],
})
export class AddPhotoComponent implements OnInit {
    @Input() img: string;
    @Input() upload: (file: File, img: string) => Promise<string>;
    file: File;

    isUploading$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    constructor(private readonly _modal: NzModalRef) {}

    ngOnInit(): void {}

    handleChange({ file, fileList }: NzUploadChangeParam): void {}

    onCancel(): void {
        this._modal.destroy(false);
    }

    onBeforeUpload = async (file: NzUploadFile) => {
        const uploadFile = file.originFileObj || file;
        this.file = uploadFile as any;
        this.img = await this.getBase64(this.file);
        return true;
    };

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    onUpload = async (item: NzUploadXHRArgs) => {
    };

    private getBase64(img: File): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () =>
                resolve(reader.result!.toString())
            );
            reader.readAsDataURL(img);
        });
    }

    async onApply() {
        this.isUploading$.next(true);
        this.upload(this.file, this.img).then(() => {
            setTimeout(() => {
                this.isUploading$.next(false);
                this._modal.destroy(true);
            }, 100);
        });

    }
}
