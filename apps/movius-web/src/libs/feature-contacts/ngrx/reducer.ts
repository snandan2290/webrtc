import { Contact } from '@movius/domain';
import { createReducer, on } from '@ngrx/store';
import {
    assoc,
    assocPath,
    fromPairs,
    map,
    omit,
    omitBy,
    pick,
    pipe,
} from 'lodash/fp';
import { pluck } from 'rxjs/operators';
import { StateStatus } from '../../shared';
import {
    createUserContactSuccess,
    deleteContactsSuccess,
    deleteContactSuccess,
    importFromMsGraphSuccess,
    rehydrateContactsSuccess,
    restoreContactsSuccess,
    setContactImage,
    updateUserContactSuccess,
    onNewContactSaveSuccess,
} from './actions';

export interface ContactsState {
    status: StateStatus;
    contacts: { [id: number]: Contact };
}

const initialState: ContactsState = {
    contacts: {},
    status: { kind: 'StateStatusInitial' },
};

const updateUserContactSuccessHandler = (
    state: ContactsState,
    {
        contact: contact,
    }:
        | ReturnType<typeof createUserContactSuccess>
        | ReturnType<typeof updateUserContactSuccess>
        | ReturnType<typeof onNewContactSaveSuccess>
) => {
    return assocPath(['contacts', contact.id], contact, state);
};

const getContactsHash = (contacts: Contact[]) =>
    pipe(
        map((c: Contact) => [c.id, c]),
        fromPairs
    )(contacts) as { [key: number]: Contact };

const mergeContacts = (
    stateContacts: { [key: number]: Contact },
    contacts: Contact[]
) => {
    const contactsHash = getContactsHash(contacts);
    return { ...stateContacts, ...contactsHash };
};

const rehydrateContactsSuccessHandler = (
    state: ContactsState,
    { result }: ReturnType<typeof rehydrateContactsSuccess>
) => {
    const merged = mergeContacts(state.contacts, result);
    return assoc('contacts', merged, state);
};

const importFromMsGraphSuccessHandler = (
    state: ContactsState,
    { contacts, resetContacts }: ReturnType<typeof importFromMsGraphSuccess>
) => {
    if (resetContacts) {
        return assoc(
            'contacts',
            fromPairs(contacts.map((contact) => [contact.id, contact])),
            state
        );
    } else {
        const merged = mergeContacts(state.contacts, contacts);
        // remove inexistent
        const mappedMerged = Object.keys(merged).map(key => (merged[key]));
        const getLineWeChatArray = mappedMerged.filter((e) => e.type == 'Line' ||  e.type == 'WeChat')
        const mergedLineWechatContacts = [ ...contacts, ...getLineWeChatArray];
        const updatedIds = mergedLineWechatContacts.map((m) => m.id);
        // console.log('updatedIds', updatedIds);
        const contactsWithoutOld = omitBy(
            (contact) => !updatedIds.includes(contact.id),
            merged
        );
        // console.log('contactsWithoutOld', contactsWithoutOld);
        return assoc('contacts', contactsWithoutOld, state);
    }
};

const restoreContactsSuccessHandler = (
    state: ContactsState,
    { result, dateTime }: ReturnType<typeof restoreContactsSuccess>
) => {
    const merged = mergeContacts(state.contacts, result);
    return {
        status: {
            kind: 'StateStatusLoaded',
            dateTime,
        },
        contacts: merged,
    } as ContactsState;
};

const setContactImageHandler = (
    state: ContactsState,
    { contactId, img }: ReturnType<typeof setContactImage>
) => assocPath(['contacts', contactId, 'img'], img, state);

const _contactsReducer = createReducer<ContactsState>(
    initialState,
    on(rehydrateContactsSuccess, rehydrateContactsSuccessHandler),
    on(importFromMsGraphSuccess, importFromMsGraphSuccessHandler),
    on(restoreContactsSuccess, restoreContactsSuccessHandler),
    on(createUserContactSuccess, updateUserContactSuccessHandler),
    on(updateUserContactSuccess, updateUserContactSuccessHandler),
    on(onNewContactSaveSuccess,updateUserContactSuccessHandler),
    on(deleteContactSuccess, (state, { id }) =>
        assoc('contacts', omit(id, state.contacts), state)
    ),
    on(setContactImage, setContactImageHandler),
    on(deleteContactsSuccess, (state) => assoc('contacts', {}, state))
);

export const contactsReducer = (state, action) => {
    return _contactsReducer(state, action);
};
