import { Injectable } from '@angular/core';
import {
    bootstrap,
    CallRepository,
    CallViewedRepository,
    ContactRepository,
    IDbContext,
    MessageRepository,
    ProfileRepository,
} from '@movius/domain';
import { EncryptService } from '@movius/encrypt';

@Injectable({ providedIn: 'root' })
export class DbContext implements IDbContext {
    profile: ProfileRepository;
    contact: ContactRepository;
    call: CallRepository;
    callViewed: CallViewedRepository;
    message: MessageRepository;
    constructor() {}
    async init(version: number, encryptService: EncryptService) {
        if(parseInt(localStorage.getItem('updateDB')) < version){
            localStorage.setItem('updateDB', version.toString());   
        }else{
            if(localStorage.getItem('updateDB')==null){
                localStorage.setItem('updateDB', version.toString());
            }
        }
        const db = await bootstrap(version, encryptService);
        this.profile = db.profile;
        this.contact = db.contact;
        this.call = db.call;
        this.message = db.message;
        this.callViewed = db.callViewed;
    }

}
