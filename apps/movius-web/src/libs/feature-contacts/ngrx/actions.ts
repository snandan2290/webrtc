import { Contact, NewContact } from '@movius/domain';
import { createAction, props } from '@ngrx/store';
import { String } from 'lodash';
import { User } from '../../shared';

export const rehydrateContactsSuccess = createAction(
    '[Contacts] Rehydrate Contacts Success',
    props<{ result: Contact[] }>()
);

export const loadContactsSuccess = createAction(
    '[Contacts] Load Contacts Success',
    props<{ result: User[] }>()
);

export const restoreContactsSuccess = createAction(
    '[Contacts] Restore Contacts Success',
    props<{ result: Contact[]; dateTime: string }>()
);

export interface ImageFile {
    img: string;
    file: File;
}

export const startCreateUserContact = createAction(
    '[Contacts] Start Create User Contact',
    props<{ contact: NewContact; imageFile?: ImageFile; contactCreatedFrom?: string; }>()
);

export const createUserContact = createAction(
    '[Contacts] Create User Contact',
    props<{
        contact: NewContact;
        imageFile?: ImageFile;
        // do not create contact if there is contact with the same number
        // if true, then action took place from contact page
        // when user call or message to new user - contact created implicitly
        isImplicit?: boolean;
        contactCreatedFrom?: string;
    }>()
);

export const createUserContactSuccess = createAction(
    '[Contacts] Create User Contact Success',
    props<{
        contact: Contact;
        isFromGalContact: boolean;
        // when user call or message to new user - contact created implicitly
        isImplicit?: boolean;
        contactCreatedFrom?: string;
    }>()
);

export const updateUserContact = createAction(
    '[Contacts] Update User Contact',
    props<{ contact: Contact; imageFile?: ImageFile }>()
);

export const updateUserContactSuccess = createAction(
    '[Contacts] Update User Contact Success',
    props<{ contact: Contact }>()
);

export const routeBack = createAction('Route to the previous url');

export const deleteContact = createAction(
    '[Contacts] Delete Contact',
    props<{ id: number; peerId: string }>()
);

export const sendCustomerOptInRequest = createAction(
    '[Contacts] Send Custome Opt-in Request',
    props<{ peerId: string, showConfirmPopup?: boolean, threadId?:string }>()
);

export const deleteContactSuccess = createAction(
    '[Contacts] Delete Contact Success',
    props<{ id: number }>()
);

export const customerOptInSuccess = createAction(
    '[Contacts] Customer opt-in Success',
    props<{ thread_id: string, messages: any[],  peerId:string, redirect?:boolean }>()
);

export const customerOptInReEngageSuccess = createAction(
    '[Contacts] Customer opt-in reEngage Success',
    props<{ threadId: string, messages: any[],  peerId:string, oldThreadId: string }>()
);

export const contactAlreadyInConversartion = createAction(
    '[Contacts] Customer already in conversation with another contact',
);

export const contactCannotCreateNewConveration = createAction(
    '[Contacts] Cannot create any more new chats with this contact. Please select an existing conversation.',
);

export const customerOptInError = createAction(
    '[Contacts] Customer opt-in Error',
    props<{ err: any }>()
);

export const deleteContactsSuccess = createAction(
    '[Contacts] Delete Contacts Success'
);
export const importFromMsGraph = createAction(
    '[Contacts] Import From MsGraph',
    props<{
        resetContacts: boolean;
        contacts: Contact[] | 'not-loaded';
        isBySchedule?: boolean;
    }>()
);

export const scheduleImportFromMsGraph = createAction(
    '[Contacts] Schedule Import From MsGraph',
    props<{ exchangeNextSyncTime: 'never' | number }>()
);

export const importFromMsGraphSuccess = createAction(
    '[Contacts] Import From MsGraph Success',
    props<{
        contacts: Contact[];
        resetContacts: boolean;
    }>()
);

export const importFromMsGraphFails = createAction(
    '[Contacts] Import From MsGraph Fails',
    props<{ error: any }>()
);

export const setContactImage = createAction(
    '[Contacts] Set Contact Image',
    props<{ contactId: number; img: string }>()
);

export const startAddToExistentContact = createAction(
    '[Contacts] Start Add To Existent Contact',
    props<{ mlNumber: string }>()
);

export const onNewContactSaveSuccess = createAction(
    '[User] New Contact Save Success ',
    props<{
        contact: Contact
    }>()
);

