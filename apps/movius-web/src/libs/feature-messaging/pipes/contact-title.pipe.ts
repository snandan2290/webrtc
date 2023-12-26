import { Pipe, PipeTransform } from '@angular/core';
import { MessagingService } from '../services/messaging.service';
import { DbContext } from '../../shared/services/db-context.service';
import { addPulsToMultilineNumber, chkonlydigits } from '../../shared';

@Pipe({
    name: 'contactTitle'
})
export class ContactTitlePipe implements PipeTransform {

    webclientUser = sessionStorage.getItem('__api_identity__');

    constructor(
        private readonly messagingService: MessagingService,
        private readonly dbContext: DbContext,
    ) { }

    transform(session: any, savedContact: any): string {
        const participantsArr: string[] = [];
        participantsArr.push(session.peer?.multiLine)
        let peers = session.participants || participantsArr;

        if(!Array.isArray(peers)){
            if(peers.includes("|"))
                peers=peers.split("|")
            else if(peers.includes(","))
                peers=peers.split(",")
        }
        if (peers && peers.length != 0) {
            if (peers.length > 1) {
                let getWhatsAppUser;
                if(session.messageChannelType != 'normalMsg'){
                        peers.filter((data) => {
                        if (data.includes('whatsapp:')) {
                            getWhatsAppUser = data;
                        }
                    })
               }

                if (getWhatsAppUser) {
                    const whatsappNumber = getWhatsAppUser?.includes('whatsapp') ? getWhatsAppUser?.replace('whatsapp:', '') : getWhatsAppUser
                    const contactName = this.messagingService.getAllContactName(whatsappNumber);
                    return contactName.substring(0, 17) + (contactName.length > 18 ? '...' : '') + ' & ' + (peers.length - 1) + ' more';
                }

                if((typeof peers === "string") ){
                    const contactName = this.messagingService.getAllContactName(peers);
                    return contactName.substring(0, 17) + (contactName.length > 18 ? '...' : '');
                }
                else if (this.webclientUser === peers[0]) {
                    const contactName = this.messagingService.getAllContactName(peers[1]);
                    return contactName.substring(0, 17) + (contactName.length > 18 ? '...' : '') + ' & ' + (peers.length - 1) + ' more';
                    //return this.splitContactname(peers.slice(1),20,"");
                    // const contactName = this.messagingService.getAllContactName(peers[1]);
                    // return contactName.substring(0, 17) + (contactName.length > 18 ? '...' : '') + ' & ' + (peers.length - 1) + ' more';
                }
                const contactName = this.messagingService.getAllContactName(peers[0]);
                return contactName.substring(0, 17) + (contactName.length > 18 ? '...' : '') + ' & ' + (peers.length - 1) + ' more';
                //return this.splitContactname(peers,20,"")
                // const contactName = this.messagingService.getAllContactName(peers[0]);
                // return contactName.substring(0, 17) + (contactName.length > 18 ? '' : '') + ' + ' + (peers.length - 1) + '';
            }

        } else if (peers[0] == 'unknown') {
            return 'Anonymous'
        }
        const multiLine = peers[0]?.includes('whatsapp') ? peers[0]?.replace('whatsapp:', '') : peers[0];

        if (savedContact.length) {
            const contact = savedContact.find(contact => contact.multiLine == multiLine);
            if (contact) {
                session.peer.name = contact.name ? contact.name : null;
            }
        }
        return session ? session.peer.name || addPulsToMultilineNumber(multiLine) : '';
    }

    splitContactname(peers:any,count:number,result:string=""){
        let contactName
        if(peers[0] ){
            let name = this.messagingService.getAllContactName(peers[0])
            contactName = name.split(" ") ? name.split(" ")[0] : name
        }
        if(count <= 0 || (count - contactName.length <= 0)){
            return result == "" ? contactName : result + " +" +peers.length;
        }else{
            if(peers.length > 1){
                count = count - contactName.length
                result = result !== '' ? result + ", "+ contactName : contactName
                return this.splitContactname(peers.slice(1),count,result)
            }else{
                return result + ", " +contactName
            }
        }
    }

    getContactTitleName (contactName, peers) {
        return chkonlydigits(contactName.substring(0, 17)) ? addPulsToMultilineNumber(contactName.substring(0, 17)) + (contactName.length > 18 ? '...' : '') + ' & ' + (peers.length - 1) + ' more' : contactName.substring(0, 17) + (contactName.length > 18 ? '...' : '') + ' & ' + (peers.length - 1) + ' more';
    }

}
