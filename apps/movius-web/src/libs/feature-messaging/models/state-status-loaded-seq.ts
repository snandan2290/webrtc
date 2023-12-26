import { StateStatus } from '../../shared';
import { LoadedSeq } from './loaded-seq';

export type StateStatusLoadedSeq = StateStatus & {
    latestLoadedSeq?: LoadedSeq;
};
