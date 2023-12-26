import { CallRepository } from './call-repository';
import { CallViewedRepository } from './call-viewed-repository';
import { ContactRepository } from './contact-repository';
import { MessageRepository } from './message-repository';
import { ProfileRepository } from './profile-repository';

export interface IDbContext {
    profile: ProfileRepository;
    contact: ContactRepository;
    call: CallRepository;
    callViewed: CallViewedRepository;
    message: MessageRepository;
}
