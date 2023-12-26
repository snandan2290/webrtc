import { clearContacts } from '@movius/domain';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { flatten } from 'lodash/fp';
import { MultiLineUriProvider, UserContactGhost } from '../models';
import { ContactsState } from './reducer';

export const selectContactsState = createFeatureSelector<ContactsState>(
    'contacts'
);

export const selectContactsHash = createSelector(
    selectContactsState,
    (state) => state.contacts
);

export const selectContactsAsList = createSelector(selectContactsHash, (hash) =>
    Object.values(hash)
);

export const selectContacts = createSelector(
    selectContactsAsList,
    clearContacts
);

export const selectContactGhosts = (p: MultiLineUriProvider) =>
    createSelector(
        selectContacts,
        (contacts) =>
            flatten(
                contacts.map((contact) =>
                    [...(contact.phones || [])].map((m) => ({
                        id: m.phone,
                        uri: p(m.phone),
                        multiLineUri: p(m.phone),
                        name:
                            //TODO: CB:09Mar2021 - TECH: Refactor - consider to use getContactFriendlyName from common-utils.
                            [contact.firstName, contact.lastName]
                                .join(' ')
                                .trim() || null,
                        img: contact.img,
                        firstName:contact.firstName,
                        lastName: contact.lastName,
                        multiLine: m.phone,
                        contact,
                        multiLineType: m.type,
                    }))
                )
            ) as UserContactGhost[]
    );

export const selectContactAsIs = (id: number) =>
    createSelector(selectContactsHash, (contacts) => contacts[id]);

export const selectContact = (id: number) =>
    createSelector(selectContacts, (contacts) =>
        contacts.find((f) => f.id === id)
    );

export const selectUserContactGhostByNumber = (p: MultiLineUriProvider) => (
    mlNumber: string
) =>
    createSelector(selectContactGhosts(p), (contacts) => {
        return contacts.find((f) => f.multiLine === mlNumber);
    });

export const selectIsContactsLoaded = createSelector(
    selectContactsState,
    (state) => state.status.kind === 'StateStatusLoaded'
);

export const selectAllContactNumbers = createSelector(
    selectContacts,
    (contacts) => {
        return flatten(contacts.map((m) => m.phones.map((m) => m.phone)));
    }
);
