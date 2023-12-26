// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// <graphServiceSnippet>
import { Injectable } from '@angular/core';
import { Client } from '@microsoft/microsoft-graph-client';
import { uniqWith } from 'lodash/fp';
import { MSGraphAuthService } from './auth.service';
import { Contact, ContactFolder, People, Person, PersonClass } from './dto';
import { range } from 'lodash';
import {LoggerFactory} from '@movius/ts-logger';

const logger = LoggerFactory.getLogger("")

const createFakeContact = (id: string) => ({
    assistantName: null,
    birthday: null,
    businessAddress: null,
    businessHomePage: null,
    businessPhones: [],
    categories: null,
    changeKey: null,
    children: null,
    companyName: null,
    createdDateTime: null,
    department: null,
    displayName: null,
    emailAddresses: [],
    fileAs: null,
    generation: null,
    givenName: id,
    homeAddress: null,
    homePhones: [],
    id,
    imAddresses: [],
    initials: null,
    jobTitle: null,
    lastModifiedDateTime: null,
    manager: null,
    middleName: id,
    mobilePhone: id + '11111',
    nickName: null,
    officeLocation: null,
    otherAddress: null,
    parentFolderId: null,
    personalNotes: null,
    profession: null,
    spouseName: null,
    surname: id,
    title: id,
    yomiCompanyName: null,
    yomiGivenName: null,
    yomiSurname: null,
    photo: null,
});

const generateContacts = (num: number) =>
    range(num).map((x) => createFakeContact(x.toString()));

@Injectable()
export class MSGraphService {
    private graphClient: Client;
    constructor(private authService: MSGraphAuthService) {
        this.graphClient = Client.init({
            authProvider: async (done) => {
                // Get the token from the auth service
                const token = await this.authService
                    .getAccessToken()
                    .catch((reason) => {
                        done(reason, null);
                    });

                if (token) {
                    done(null, token);
                } else {
                    const error = 'Could not get an access token';
                    done(error, null);
                }
            },
        });
    }

    async getContactFolders(): Promise<ContactFolder[]> {
        const result = await this.graphClient
            .api('/me/contactFolders?$top=1000')
            .get();

        return result.value;
    }

    async getFolderContacts(folderId: string): Promise<Contact[]> {
        const result = await this.graphClient
            .api(`/me/contactFolders/${folderId}/contacts?$top=1000`)
            .get();

        return result.value;
    }

    private async getDefaultContactsPage(page: number): Promise<Contact[]> {
        const result = await this.graphClient
            .api(`/me/contacts?$skip=${page * 1000}&$top=1000`)
            .get();

        return result.value;
    }

    async getDefaultContacts(): Promise<Contact[]> {
        let page = 0;
        let pageResultCount = 0;
        let result = [];

        do {
            const pageResult = await this.getDefaultContactsPage(page++);
            result = [...result, ...pageResult];
            pageResultCount = pageResult.length;
        } while (pageResultCount === 1000);

        return result;
    }

    async getPeopleSingleWord(term: string): Promise<Person[]> {
        term = term && term.toLowerCase();
        const result: People = await this.graphClient
            .api(`/me/people`)
            .query(`$search=${term}&$filter=personType/class eq 'Person' and personType/subclass eq 'OrganizationUser'`)
            .header('X-PeopleQuery-QuerySources', 'Mailbox,Directory')
            .get();

        // const result = JSON.parse(JSON.stringify({"@odata.context":"https://graph.microsoft.com/v1.0/$metadata#users('fc743585-c621-42d0-8770-d45fadc64434')/people","value":[{"id":"3d237b23-22f2-46ff-a892-ac3a88bd7133","displayName":"Vinaykumar Putta","givenName":"Vinaykumar","surname":"Putta","birthday":null,"personNotes":null,"isFavorite":false,"jobTitle":"Contractor","companyName":"Movius Interactive Corporation","yomiCompany":null,"department":"3156 Cafe-India","officeLocation":"Remote","profession":null,"userPrincipalName":"Vinaykumar.Putta@movius.ai","imAddress":"sip:vinaykumar.putta@movius.ai","scoredEmailAddresses":[{"address":"Vinaykumar.Putta@Movius.ai","relevanceScore":0.0,"selectionLikelihood":"notSpecified"}],"phones":[],"personType":{"class":"Person","subclass":"OrganizationUser"}},{"id":"1b0616c7-51e1-4dfd-a65e-30ff92876b2e","displayName":"Vinayak Madiwal","givenName":"Vinayak","surname":"Madiwal","birthday":null,"personNotes":null,"isFavorite":false,"jobTitle":"Sr. IT System Engineer 1","companyName":"Movius Interactive Corporation","yomiCompany":null,"department":"7191  Administration - India","officeLocation":"054 Bangalore, India","profession":null,"userPrincipalName":"Vinayak.Madiwal@movius.ai","imAddress":"sip:vinayak.madiwal@movius.ai","scoredEmailAddresses":[{"address":"vinayak.madiwal@movius.ai","relevanceScore":-6.0,"selectionLikelihood":"notSpecified"}],"phones":[{"type":"business","number":"+1 4702463738"}],"personType":{"class":"Person","subclass":"OrganizationUser"}},{"id":"c3d54cb4-646e-424a-aafa-6c77d2975029","displayName":"Vinayaka H","givenName":"Vinayaka","surname":"H","birthday":null,"personNotes":null,"isFavorite":false,"jobTitle":"Quality Assurance Engineer 3","companyName":"Movius Interactive Corporation","yomiCompany":null,"department":"3165 Infrastructure VAV - India","officeLocation":"054 Bangalore, India","profession":null,"userPrincipalName":"Vinayaka.H@movius.ai","imAddress":"sip:vinayaka.h@movius.ai","scoredEmailAddresses":[{"address":"Vinayaka.H@Movius.ai","relevanceScore":-6.0,"selectionLikelihood":"notSpecified"}],"phones":[{"type":"business","number":"+1 4702137440"}],"personType":{"class":"Person","subclass":"OrganizationUser"}},{"id":"ce40620b-13fc-403f-8dfa-a9c1f01fdcda","displayName":"Venkatesh Garikapati","givenName":"Venkatesh","surname":"Garikapati","birthday":null,"personNotes":null,"isFavorite":false,"jobTitle":"Contractor","companyName":"Movius Interactive Corporation","yomiCompany":null,"department":"3165 Infrastructure VAV-India","officeLocation":"054 Bangalore, India","profession":null,"userPrincipalName":"Venkatesh.Garikapati@movius.ai","imAddress":"sip:venkatesh.garikapati@movius.ai","scoredEmailAddresses":[{"address":"Venkatesh.Garikapati@Movius.ai","relevanceScore":-13.0,"selectionLikelihood":"notSpecified"}],"phones":[],"personType":{"class":"Person","subclass":"OrganizationUser"}}]}))
        const people = result.value.filter(
            (m) => m.personType.class === PersonClass.Person
        );
        logger.debug(`API filter = gal contact length is "${people.length}" and the search term is "${term}"'\n'`)
        
        return people;
    }

    async getPeopleDoubleWord(term1: string, term2: string): Promise<Person[]> {
        const [res1, res2] = await Promise.all([
            this.getPeopleSingleWord(term1),
            this.getPeopleSingleWord(term2),
        ]);

        const res = uniqWith((a, b) => a.id === b.id, [...res1, ...res2]);

        return res;
    }

    async getPeople(term: string): Promise<Person[]> {
        const terms = term.split(' ').filter((f) => !!f);
        if (terms.length > 1) {
            return this.getPeopleDoubleWord(terms[0], terms[1]);
        } else {
            return this.getPeopleSingleWord(term);
        }
    }

    async getContacts(): Promise<Contact[]> {
        const folders = await this.getContactFolders();
        const folderIds = folders.map((folder) => folder.id);
        const contacts = [
            ...folderIds.map((id) => this.getFolderContacts(id)),
            this.getDefaultContacts(),
        ];
        const resultAll = await Promise.all(contacts);

        const result: Contact[] = [].concat(...resultAll);

        return result;
    }

    /*
    async getPeopleAndContacts(): Promise<
        ((Contact & { kind: 'contact' }) | (Person & { kind: 'person' }))[]
    > {
        const [contacts, people] = await Promise.all([
            this.getContacts(),
            this.getPeople(),
        ]);

        return [
            ...contacts.map((m) => ({ ...m, kind: 'contact' as 'contact' })),
            ...people.map((m) => ({ ...m, kind: 'person' as 'person' })),
        ];
    }
    */

    async getContactPhoto(id: string): Promise<string> {
        const response = await this.graphClient
            .api(`/me/contacts/${id}/photo/$value`)
            .get();
        const avatar = await this.getBase64(response);
        return avatar;
    }

    async getContactPhotoMeta(id: string): Promise<string> {
        const response = await this.graphClient
            .api(`/me/contacts/${id}/photo`)
            .get();
        return response;
    }

    async createContactAndPhoto(dto: Partial<Contact>, file: File) {
        const contact = await this.createContact(dto);
        if (file) {
            await this.updateContactPhoto(contact.id, file);
        }
        return contact;
    }

    async deleteContact(id: string) {
        return await this.graphClient.api(`/me/contacts/${id}`).delete();
    }

  

    async updateContactAndPhoto(
        contactId: string,
        dto: Partial<Contact>,
        file: File
    ) {
        const contact = await this.updateContact(contactId, dto);
        if (file) {
            await this.updateContactPhoto(contact.id, file);
        }
        return contact;
    }

    private async updateContact(contactId: string, dto: Partial<Contact>) {
        return this.graphClient.api(`/me/contacts/${contactId}`).patch(dto);
    }

    private async createContact(dto: Partial<Contact>) {
        return this.graphClient.api(`/me/contacts`).post(dto);
    }

    private async updateContactPhoto(contactId: string, file: File) {
        return this.graphClient
            .api(`/me/contacts/${contactId}/photo/$value`)
            .put(file);
    }

    private getBase64(img: Blob): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () =>
                resolve(reader.result!.toString())
            );
            reader.readAsDataURL(img);
        });
    }
}
