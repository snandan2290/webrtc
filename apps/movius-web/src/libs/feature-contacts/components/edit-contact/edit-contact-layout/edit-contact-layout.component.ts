import { Location } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef } from '@angular/core';
import { Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
    Contact,
    ContactAddress,
    ContactAddressType,
    NewContact,
} from '@movius/domain';
import { Store } from '@ngrx/store';
import {
    cleanPhoneNumber,
    PhoneNumberService,
    SipUserService,
    topLevelDomainEmailValidator,
    allowedSpecialCharacters,
    addPulsToMultilineNumber,
    getChannelTypeForLineWechatDetails,
    getFeatureEnabled
} from 'apps/movius-web/src/libs/shared';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
    FormArray as FA,
    FormBuilder as FB,
    FormGroup as FG,
} from 'ngx-strongly-typed-forms';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { map, skipWhile, switchMap, take } from 'rxjs/operators';
import {
    routeBack,
    selectContactAsIs,
    startCreateUserContact,
    updateUserContact,
} from '../../../ngrx';
import { AddPhotoComponent } from '../../add-photo/add-photo.component';
import { ContactName } from '../edit-contact-name/edit-contact-name.component';
import { ContactOther } from '../edit-contact-other/edit-contact-other.component';
import { ContactPhone } from '../edit-contact-phones/edit-contact-phones.component';
import { ContactWork } from '../edit-contact-work/edit-contact-work.component';

export interface ContactView {
    id: number;
    title: string;
    isCreateMode: boolean;
    contact: Contact;
    form: FG<ContactForm>;
    img: string;
}

export interface ContactForm {
    name: ContactName;
    emails: string[];
    phones: ContactPhone[];
    addresses: ContactAddress[];
    work: ContactWork;
    other: ContactOther;
    chat: string;
    note: string;
}

export interface ImgFile {
    file: File;
    img: string;
}

export type PhoneType = 'BusinessPhone' | 'MobilePhone' | 'HomePhone';

const getFirstAvailableType = (phones: ContactPhone[]) => {
    const defaultPhoneTypes = {
        BusinessPhone: 2,
        MobilePhone: 2,
        HomePhone: 2,
    };

    const reduced = phones.reduce(
        (acc, v) => ({ ...acc, [v.type]: acc[v.type] - 1 }),
        defaultPhoneTypes
    );

    const firstAvailable = Object.keys(reduced).find((k) => reduced[k] > 0);

    return firstAvailable;
};

const addNewPhone = (phones: ContactPhone[], mlNumber: string) => {
    const type = getFirstAvailableType(phones);
    return type ? [{ type, phone: mlNumber }] : [];
};

@Component({
    selector: 'movius-web-edit-contact-layout',
    templateUrl: './edit-contact-layout.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactLayoutComponent {
    currentActive: ElementRef;
    view$: Observable<ContactView>;
    img$ = new BehaviorSubject<ImgFile | 'initial' | null>('initial');

    public prefCountryCode: string;
    public prefCountryName: string;
    public isLoading: boolean;

    private maxEmailLimit: number = 3;
    private maxTotalPhones: number = 6;
    private maxBusinessPhones: number = 2;
    private maxMobilePhones: number = 2;
    private maxHomePhones: number = 2;
    hideOnLineWeChatContact: boolean = false;
    messageChannelType: any;
    appEmbededStatus: string;


    constructor(
        private readonly fb: FB,
        private readonly modalService: NzModalService,
        private readonly store: Store,
        private readonly activatedRoute: ActivatedRoute,
        private readonly router: Router,
        private readonly location: Location,
        private sipUserService: SipUserService,
        private readonly phoneService: PhoneNumberService,
        private ref: ChangeDetectorRef
    ) {
        this.appEmbededStatus = getFeatureEnabled();
        sessionStorage.setItem('operator', null);
        const userInfo = sipUserService.user;
        this.prefCountryCode = phoneService.getUserCountryCode(userInfo);
        this.prefCountryName = phoneService.getUserCountryName(userInfo);

        const id$ = activatedRoute.params.pipe(
            map(({ id }) => ({
                id: +id,
            }))
        );

        this.getMessageChannelType(activatedRoute.snapshot.params['mlnumber']);

        let contact$ = id$.pipe(
            switchMap(({ id }) => {
                // router.getCurrentNavigation(); is not working on next tick ?
                const contact = window.history?.state?.originContact;
                if (contact) {
                    return of(contact);
                } else {
                    const contactId = id;
                    return contactId
                        ? store
                            .select(
                                selectContactAsIs(contactId),
                                skipWhile((f) => !f)
                            )
                            .pipe(
                                map((contact) => this.formattingPhonesOrder(id,contact)
                                )
                            )
                        : of(null);
                }
            })
        );

        const form$ = contact$.pipe(
            map((contact) =>
                this.createForm(
                    this.fb,
                    contact || {},
                    activatedRoute.snapshot.params['mlnumber']
                )
            ),
            take(1)
        );

        this.view$ = combineLatest([form$, contact$, this.img$]).pipe(
            map(([form, contact, img]) => {
                const isCreateMode = !contact || !contact.id;
                const view = {
                    id: contact?.id,
                    title: isCreateMode ? 'Create' : 'Update',
                    contact,
                    isCreateMode,
                    form,
                    img: img === 'initial' ? contact?.img : img?.img,
                };
                return view;
            })
        );
    }

    ngOnInit(): void {
        this.phoneService.isContactCreated.subscribe((res) => {
            this.isLoading = res;
            this.ref.markForCheck();
        })
    }
    
    getLogoContact(contact: Contact, img: string) {
        return { ...contact, img };
    }

    formattingPhonesOrder(id:any, contact:any){
        if(id){
            let arrayOrder = ['BusinessPhone','MobilePhone','HomePhone'];
            let resultArray:any=[];
            for(let i = 0; i < arrayOrder?.length; i++){
                for(let j = 0; j < contact?.phones?.length; j++){
                    if(contact.phones[j]['type'] === arrayOrder[i]){
                        resultArray.push(contact.phones[j]);
                    }
                }
            }
            return { ...contact, phones: resultArray }
        } else {
          return { ...contact, id: null }
        }
    }

    private createContact() {
        for (let i = 0; i < this.router.url.split('/').length - 1; i++) {
            if (this.router.url.split('/')[this.router.url.split('/').length - i] === 'new' || this.router.url.split('/')[this.router.url.split('/').length - i] === 'edit') {
                return true;
            } else {
                if (this.router.url.split('/').length == 5) {
                    if (this.router.url.split('/')[this.router.url.split('/').length - i] === 'edit') {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private createForm(fb: FB, contact: Contact, mlnumber: string) {
        if (this.createContact() && mlnumber !== undefined) {
            mlnumber = '+' + mlnumber;
        }
        const nameExtras = contact.nameExtras;
        const hasAnyEmail = contact.emails && contact.emails.length > 0;
        const hasAnyPhone = contact.phones && contact.phones.length > 0;
        const result = fb.group<ContactForm>({
            chat: fb.control<string>(contact.chat || null),
            note: fb.control<string>(contact.note || null),
            other: fb.group<ContactOther>({
                personalWebPage: fb.control<string>(
                    (contact.other && contact.other.personalWebPage) || null
                ),
                significantOther: fb.control<string>(
                    (contact.other && contact.other.significantOther) || null
                ),
                birthday: fb.control<string>(
                    (contact.other && contact.other.birthday) || null
                ),
            }),
            work: fb.group<ContactWork>({
                company: fb.control<string>(
                    (contact.work && contact.work.company) || ''
                ),
                jobTitle: fb.control<string>(
                    (contact.work && contact.work.jobTitle) || null
                ),
                yomiCompany: fb.control<string>(
                    (contact.work && contact.work.yomiCompany) || null
                ),
            }),
            emails: fb.array<string>(
                hasAnyEmail
                    ? (contact.emails || []).map((m) =>
                        fb.control<string>(m.email, [
                            topLevelDomainEmailValidator(),
                        ])
                    )
                    : [fb.control<string>('', [topLevelDomainEmailValidator()])]
            ),
            phones: fb.array<ContactPhone>(
                hasAnyPhone
                    ? [
                        ...(contact.phones || []),
                        ...(mlnumber
                            ? addNewPhone(contact.phones as any[], mlnumber)
                            : []),
                    ].map((m) =>
                        fb.group<ContactPhone>({
                            phone: fb.control<string>(addPulsToMultilineNumber(m.phone) || '', [
                                Validators.required,
                            ]),
                            orgPhone: fb.control<string>(addPulsToMultilineNumber(m.phone) || '', []),
                            type: fb.control<PhoneType>(
                                m.type === 'unknown'
                                    ? 'MobilePhone'
                                    : (m.type as PhoneType)
                            ),
                        })
                    )
                    : [
                        fb.group<ContactPhone>({
                            phone: fb.control<string>(addPulsToMultilineNumber(mlnumber) || '', [
                                Validators.required,
                            ]),
                            orgPhone: fb.control<string>(addPulsToMultilineNumber(mlnumber) || '', []),
                            type: fb.control<PhoneType>('BusinessPhone'),
                        }),
                    ]
            ),
            addresses: fb.array<ContactAddress>(
                (contact.addresses || []).map((m) =>
                    fb.group<ContactAddress>({
                        street: fb.control<string>(m.street),
                        street2: fb.control<string>(m.street2),
                        city: fb.control<string>(m.city),
                        state: fb.control<string>(m.state),
                        country: fb.control<string>(m.country),
                        postal: fb.control<string>(m.postal),
                        type: fb.control<ContactAddressType>(
                            m.type as ContactAddressType
                        ),
                    })
                )
            ),
            name: fb.group<ContactName>({
                title: fb.control<string>(
                    (nameExtras && nameExtras.title) || null
                ),
                firstName: fb.control<string>(contact.firstName || '', [
                    Validators.required,
                ]),
                lastName: fb.control<string>(contact.lastName || '', [
                    Validators.required,
                ]),
                middleName: fb.control<string>(
                    (nameExtras && nameExtras.middleName) || null
                ),
                nickName: fb.control<string>(
                    (nameExtras && nameExtras.nickName) || null
                ),
                suffix: fb.control<string>(
                    (nameExtras && nameExtras.suffix) || null
                ),
                yomiFirstName: fb.control<string>(
                    (nameExtras && nameExtras.yomiFirstName) || null
                ),
                yomiLastName: fb.control<string>(
                    (nameExtras && nameExtras.yomiLastName) || null
                ),
            }),
        });
        return result;
    }

    onApply(
        id: number,
        originalContact: Contact,
        form: FG<ContactForm>,
        isCreateMode: boolean
    ) {
        this.isLoading = true;
        sessionStorage.setItem('operator', null);
        const value = form.value;
        const contact: NewContact = {
            type: this.messageChannelType ? this.messageChannelType : 'personal',
            chat: value.chat,
            note: value.note,
            firstName: value.name.firstName?.trim(),
            lastName: value.name.lastName?.trim(),
            img: originalContact?.img,
            nameExtras: {
                title: value.name.title,
                middleName: value.name.middleName,
                suffix: value.name.suffix,
                nickName: value.name.nickName,
                yomiFirstName: value.name.yomiFirstName,
                yomiLastName: value.name.yomiLastName,
            },
            other: value.other,
            work: value.work,
            phones: value.phones
                .filter((f) => !!f && !!f.phone)
                .map((m) => ({ ...m, phone: m.phone })),
            emails: value.emails
                .filter((f) => !!f)
                .map((email) => ({ email, type: 'unknown' })),
            addresses: value.addresses.filter(
                (f) =>
                    !!f &&
                    (f.city ||
                        f.country ||
                        f.postal ||
                        f.state ||
                        f.street2 ||
                        f.street) ||
                        f.type
            ),
            msGraphId: originalContact?.msGraphId,
        };
        const imageFileValue = this.img$.getValue();
        const imageFile =
            imageFileValue === 'initial' ? undefined : imageFileValue;
        if (isCreateMode) {
            this.store.dispatch(startCreateUserContact({ contact, imageFile }));
        } else {
            this.store.dispatch(
                updateUserContact({ contact: { ...contact, id }, imageFile })
            );
        }
    }

    onCancel() {

        if (this.appEmbededStatus === 'messaging') {
            this.store.dispatch(routeBack());
        }else{
            window.history.back();
        }
        // // window.history.back();
        // this.router.navigate(['../../../'], { relativeTo: this.activatedRoute });
    }

    openAddPhotoDialog(img: string) {
        this.modalService.create({
            nzContent: AddPhotoComponent,
            nzComponentParams: {
                img,
                upload: this.uploadAvatar,
            },
            nzWidth: '26.25rem',
            nzFooter: null,
        });
    }

    private readonly uploadAvatar = (file: File, img: string) => {
        this.img$.next({ file, img });
        return Promise.resolve(img);
        /*
        const success$ = this.actions
            .pipe(
                ofType(updateContactImageSuccess, updateContactImageFail),
                filter(({ contactId: cid }) => cid === contactId),
                take(1)
            )
            .toPromise();

        this.store.dispatch(updateContactImage({ file, img, contactId }));

        const result = await success$;

        if (result.type === '[Contacts] Update contact image success') {
            return result.img;
        } else {
            throw result.error;
        }
        */
    };

    //#endregion Utils

    // Name
    onAddNameTitle(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.title.setValue('');
    }

    onAddNameMiddleName(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.middleName.setValue(
            ''
        );
    }

    onAddNameSuffix(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.suffix.setValue('');
    }

    onAddNickName(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.nickName.setValue('');
    }

    onAddYomiName(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.yomiFirstName.setValue(
            ''
        );
        (form.controls.name as FG<ContactName>).controls.yomiLastName.setValue(
            ''
        );
    }

    // Emails

    canAddEmail(form: FG<ContactForm>) {
        return (form.controls.emails as FA<string>).length < this.maxEmailLimit;
    }

    onAddEmail(form: FG<ContactForm>) {
        if ((form.controls.emails as FA<string>).length >= this.maxEmailLimit) {
            return;
        }
        (form.controls.emails as FA<string>).push(
            this.fb.control('', [topLevelDomainEmailValidator()])
        );
    }

    onRemoveEmail(form: FG<ContactForm>, index: number) {
        (form.controls.emails as FA<string>).removeAt(index);
    }

    canAddAnything(form: FG<ContactForm>) {
        const f =
            this.canAddEmail(form) ||
            this.canAddSomePhone(form) ||
            this.canAddName(form) ||
            this.canAddChat(form) ||
            this.canAddWork(form) ||
            this.canAddSomeAddress(form) ||
            this.canAddOther(form);
        console.log(
            '+++',
            this.canAddEmail(form),
            this.canAddSomePhone(form),
            this.canAddName(form),
            this.canAddChat(form),
            this.canAddWork(form),
            this.canAddSomeAddress(form),
            this.canAddOther(form)
        );
        return f;
    }

    canAddChat(form: FG<ContactForm>) {
        return form?.value?.chat === null;
    }

    canAddOther(form: FG<ContactForm>) {
        return (
            form?.value?.other?.personalWebPage === null ||
            form?.value?.other?.significantOther === null ||
            form?.value?.other?.birthday === null
        );
    }

    canAddWork(form: FG<ContactForm>) {
        return (
            form?.value?.work?.jobTitle === null ||
            form?.value?.work?.yomiCompany === null
        );
    }

    canAddPhone(form: FG<ContactForm>, type: PhoneType) {
        const totalPhones = form?.value?.phones?.length;
        const count = form?.value?.phones?.filter((f) => f.type === type)
            .length;
        if (totalPhones >= this.maxTotalPhones) {
            return false;
        }
        if (type === 'BusinessPhone') {
            return count < this.maxBusinessPhones;
        } else if (type === 'MobilePhone') {
            return count < this.maxMobilePhones;
        } else {
            return count < this.maxHomePhones;
        }
    }

    canAddName(form: FG<ContactForm>) {
        return (
            form?.value?.name?.title === null ||
            form?.value?.name?.middleName === null ||
            form?.value?.name?.suffix === null ||
            form?.value?.name?.nickName === null ||
            form?.value?.name?.yomiFirstName === null
        );
    }

    canAddSomePhone(form: FG<ContactForm>) { 
        this.getMessageChannelType(form?.value?.phones[0].phone)
        if (this.hideOnLineWeChatContact) {
            return
        }
        return (
            this.canAddPhone(form, 'BusinessPhone') ||
            this.canAddPhone(form, 'MobilePhone') ||
            this.canAddPhone(form, 'HomePhone')
        );
    }

    onAddPhone(form: FG<ContactForm>, type: PhoneType) {
        (form.controls.phones as FA<ContactPhone>).push(
            this.fb.group<ContactPhone>({
                phone: this.fb.control<string>('', [
                    Validators.required,
                ]),
                orgPhone: this.fb.control<string>('', []),
                type: this.fb.control<PhoneType>(type),
            })
        );
    }

    onRemovePhone(form: FG<ContactForm>, index: number) {
        (form.controls.phones as FA<ContactPhone>).removeAt(index);
    }

    // Address
    hasAddress(form: FG<ContactForm>, type: ContactAddressType) {
        return (form.value.addresses || []).some((f) => f.type === type);
    }

    onAddAddress(form: FG<ContactForm>, type: ContactAddressType) {
        (form.controls.addresses as FA<ContactAddress>).push(
            this.fb.group<ContactAddress>({
                street: this.fb.control<string>(null),
                street2: this.fb.control<string>(null),
                city: this.fb.control<string>(null),
                state: this.fb.control<string>(null),
                country: this.fb.control<string>(null),
                postal: this.fb.control<string>(null),
                type: this.fb.control<ContactAddressType>(type),
            })
        );
    }

    canAddSomeAddress(form: FG<ContactForm>) {
        return (
            !this.hasAddress(form, 'BusinessAddress') ||
            !this.hasAddress(form, 'HomeAddress') ||
            !this.hasAddress(form, 'OtherAddress')
        );
    }

    onRemoveAddress(form: FG<ContactForm>, index: number) {
        let addresses:any = form.controls.addresses.value;
        addresses[index] = {type: form.controls.addresses.value[index].type, street: null, street2: null, city: null, state: null, country: null, postal: null}
        form.controls.addresses.setValue(addresses)
    }

    // work
    onAddJobTitle(form: FG<ContactForm>) {
        (form.controls.work as FG<ContactWork>).controls.jobTitle.setValue('');
    }

    onAddYomiCompany(form: FG<ContactForm>) {
        (form.controls.work as FG<ContactWork>).controls.yomiCompany.setValue(
            ''
        );
    }

    // other

    hasOther(form: FG<ContactForm>) {
        const fg = form.controls.other.value;
        return (
            fg &&
            (fg.personalWebPage !== null ||
                fg.significantOther !== null ||
                fg.birthday !== null)
        );
    }

    onAddOtherPersonalWebPage(form: FG<ContactForm>) {
        (form.controls.other as FG<
            ContactOther
        >).controls.personalWebPage.setValue('');
    }
    onAddOtherSignificantOther(form: FG<ContactForm>) {
        (form.controls.other as FG<
            ContactOther
        >).controls.significantOther.setValue('');
    }
    onAddOtherBirthday(form: FG<ContactForm>) {
        (form.controls.other as FG<ContactOther>).controls.birthday.setValue(
            ''
        );
    }

    onAddChat(form: FG<ContactForm>) {
        form.controls.chat.setValue('');
    }

    onRemoveChat(form: FG<ContactForm>) {
        form.controls.chat.setValue(null);
    }

    onAddNote(form: FG<ContactForm>) {
        form.controls.note.setValue('');
    }

    onRemoveTitle(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.title.setValue(null);
    }

    onRemoveSuffix(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.suffix.setValue(null);
    }

    onRemoveMiddlename(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.middleName.setValue(
            null
        );
    }

    onRemoveNickname(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.nickName.setValue(
            null
        );
    }

    onRemoveYomiNames(form: FG<ContactForm>) {
        (form.controls.name as FG<ContactName>).controls.yomiFirstName.setValue(
            null
        );
        (form.controls.name as FG<ContactName>).controls.yomiLastName.setValue(
            null
        );
    }

    isValid(form: FG<ContactForm>) {
        const isBusinessPhone =  form.value.phones.filter(e => e.type === "BusinessPhone");
        if (form.valid) {
            let isSomePhoneValid = form?.value?.phones?.some(
                (f,i) => { 
                    if(i === 0 && f.type === "BusinessPhone" ){ 
                        //validating first busniess phone no
                        return (f.phone && f.phone.replace(/\+/, '').length > 1)
                    }
                }
            );
            if(isBusinessPhone.length > 0){
                if(isBusinessPhone[0]['phone'] !== '' || isBusinessPhone[1]['phone'] !== ''){
                    isSomePhoneValid = true;
                }
            } else {
                isSomePhoneValid = true;
            }

            form.value.phones.forEach((e) => {
                let allowedCharcs = [
                    '-', '+', '(', ')', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ',', ' '
                  ];
                let clndNumber = cleanPhoneNumber(e.phone);
                if(clndNumber == '911'){
                    isSomePhoneValid = true
                } else if(clndNumber == this.prefCountryCode || clndNumber.length <= 4 || allowedSpecialCharacters(clndNumber, allowedCharcs)){
                 isSomePhoneValid = false
                }                
            });

            return isSomePhoneValid;
        } else {
            let isError:any;
            let emailPattern:any = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;  
            for(let i =0; i < form?.value?.phones?.length; i++){
                if(form?.value?.name?.firstName === '' || form?.value?.name?.lastName === ''){
                    isError =  false;
                    break;
                }
                if(i === 0 && form.value.phones[i].type === "BusinessPhone" || form?.value?.emails){ 
                    //validating first busniess phone no
                    isError = (form.value.phones[i].phone && form.value.phones[i].phone.replace(/\+/, '').length > 1 && form?.value?.emails.join('').match(emailPattern) !== null);
                    break;
                } else {
                    isError = true;
                }
            }
            return isError;
        }
    }

    getMessageChannelType (messageChannelType) {
        this.hideOnLineWeChatContact = false;
        messageChannelType = getChannelTypeForLineWechatDetails(messageChannelType)
        if (messageChannelType == 'Line' || messageChannelType == 'WeChat') {
            this.messageChannelType = messageChannelType;
            this.hideOnLineWeChatContact = true
        } 
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

}
