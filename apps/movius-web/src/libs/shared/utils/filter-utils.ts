import { Contact } from '@movius/domain';
import {
    UserContact,
    UserContactGhost,
} from '../../feature-contacts/models/contact';

export let resultVal: any;

export const filterState = <T extends { peer: UserContactGhost | UserContact }>(
    state: T[],
    search: string,
    savedContact?: any,
    searchInContacts:boolean=true
) => (filterWithMsgContent(state, search, savedContact, searchInContacts));

export const filterNameOrPhone2 = (
    srcUser: UserContactGhost | UserContact,
    search: string,
    savedContact?: any
): boolean => {
    search = search?.toLowerCase();
    const contact = srcUser.contact; //'multiLine' in srcUser ? srcUser.contact : srcUser;
    if(search.length >= 2) {
    if (contact) {
        let fullName = [contact.firstName !== null? contact.firstName?.trim() : contact.firstName,
            contact.lastName !== null ? contact.lastName.trim() : contact.lastName].join(' ');
        const newModelMatch =
            contact.firstName
                ?.trim()
                .toLowerCase()
                .startsWith(search?.toLowerCase()) ||
            contact.lastName
                ?.trim()
                .toLowerCase()
                .startsWith(search?.toLowerCase()) ||
            srcUser.multiLine
                .trim()
                .toLowerCase()
                .includes(search?.toLowerCase()) ||
            fullName
            .trim()
            .toLowerCase()
            .includes(search?.toLowerCase());  
        return newModelMatch;
    } else {
        const ghost = 'multiLine' in srcUser ? srcUser : null;
        const newModelMatch = (
            ghost.multiLine
            ?.trim()
            .toLowerCase()
            .startsWith(search?.toLowerCase()) ||
            compareGroupPeerId(savedContact, ghost, search)
        );
        return newModelMatch;
    }
}
};


export const filterWithMsgContent = (state: any, search: any, savedContact: any, searchInContacts:boolean) => {
    sessionStorage.setItem('msg_search_content', search);
    search = search ? search?.toLowerCase(): null;
    let Filteredmsgs = [];

    if(search && search.length >= 2) {
        if (state != null) {
            for (let i = 0; i < state.length; i++) {
                let count = 0;
                setLatestMessage(state, i, search);
                for (let j = 0; j < state[i].messages?.length; j++) {
                    if (state[i].messages.some(m => m.content.toLowerCase().includes(search))) {
                        count += 1;
                        if (count == 1) {
                            Filteredmsgs.push(state[i]);
                        }
                    }
                }
            }
            if(searchInContacts){
                let contactsWithNameOrNumber = state.filter((f) => filterNameOrPhone2(f.peer, search, savedContact))
                contactsWithNameOrNumber.forEach(element => {
                    Filteredmsgs.push(element);
                });
            }
            return Filteredmsgs;
        }
    }else{
        // return state;
        for (let i = 0; i < state.length; i++) {
            setLatestMessage(state, i, search);
        }
        return state;
    }
}

function setLatestMessage(state,  i, search){
    if(state[i].messages){
        const latestMessage = state[i].messages ? state[i].messages.find(m => m?.content?.toLowerCase().includes(search)): null;
        state[i].latestMessage = latestMessage
    }
}

export const compareGroupPeerId = (savedContact, ghost, search) => {
    let resultValue :any = [];
    let returnValue:any = [];
    savedContact.forEach(element => {
        if(element['name']?.toLowerCase().includes(search?.toLowerCase())){
            returnValue.push({'fullName':element.name, 'multiLine':element.multiLine})
        }
    });
    for (let i = 0; i < savedContact.length; i += 1) {
        if (savedContact[i]['name']?.toLowerCase().includes(search?.toLowerCase()) || savedContact[i]['multiLine']?.includes(search?.toLowerCase())) {
            if (ghost['multiLine']?.includes(savedContact[i]['multiLine'])) {
                resultValue.push(savedContact[i]['multiLine']);
                return true;
            }
        }
    }
}

export const filterNameOrPhone = (
    srcUser: UserContactGhost | UserContact | Contact,
    search: string,
): boolean => {
    search = search?.toLowerCase();
    const contact = 'multiLine' in srcUser ? srcUser.contact : srcUser;
    if (contact) {
        let fullName = [contact.firstName !== null? contact.firstName?.trim() : contact.firstName,
            contact.lastName !== null ? contact.lastName.trim() : contact.lastName].join(' ');
       
        const newModelMatch =
        contact.firstName?.trim().toLowerCase().startsWith(search?.toLowerCase()) ||
        contact.lastName?.trim().toLowerCase().startsWith(search?.toLowerCase()) ||
        fullName?.trim().toLowerCase().startsWith(search?.toLowerCase()) ||
            contact.phones?.some((data) =>
                data?.phone
                    ?.trim()
                    .toLowerCase()
                    .includes(search?.toLowerCase())
            );
        return newModelMatch;
    } else {
        const ghost = 'multiLine' in srcUser ? srcUser : null;
        return ghost.multiLine
            ?.trim()
            .toLowerCase()
            .startsWith(search?.toLowerCase());
    }
};
