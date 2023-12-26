import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { addSeconds } from 'date-fns';
import { AuthService, GeoHttpService } from '../../shared';
import { HistorySession } from '../models';
import { Call, GetCallsDTO } from './dto';

const mapHistorySession = (dto: Call): HistorySession => ({
    id: dto.uuid,
    kind: 'HistorySessionCompleted',
    peerId: dto.call_type === 'OUT' ? dto.called_number : dto.caller_number,
    startTime: new Date(+dto.call_starttime * 1000).toISOString(),
    endTime: addSeconds(
        +dto.call_starttime * 1000,
        +dto.call_duration
    ).toISOString(),
    type: dto.call_type === 'MISD' ? 'rejected' : 'accepted',
    direction: dto.call_type === 'OUT' ? 'outgoing' : 'incoming',
    isAnonymous:
        (dto.call_type == 'IN' || dto.call_type === 'MISD') &&
        dto.caller_number === 'unknown',
});

const mapDto = (calls: Call[]): HistorySession[] =>
    calls.map(mapHistorySession);

@Injectable({ providedIn: 'root' })
export class CallingDataAccessService {
    constructor(
        private readonly http: HttpClient,
        private readonly authService: AuthService,
        private readonly geoHttpService: GeoHttpService,
    ) { }

    loadInitialHistory() {
        return this.loadHistory().then(mapDto);
    }

    loadHistoryStartTS() {
        return this.loadHistory().then(mapDto);
    }

    private async loadHistory() {
        let offset = 0;
        let latestCount = 0;
        const limit = 50;
        const calls: Call[] = [];
        do {
            const result = await this.loadHistoryPage(offset, limit);
            const resultCalls = result.calls || [];
            latestCount = resultCalls.length;
            calls.push(...resultCalls);
            offset += limit;
        } while (latestCount === limit);
        return calls;
    }

    private loadHistoryPage(offset: number, limit: number) {
        const url = `services/callapi/${this.authService.apiName}/${this.authService.apiIdentity}/get_calls?offset=${offset}&limit=${limit}&api_token=${this.authService.apiToken}&ver=1`;
        // return this.http.get<GetCallsDTO>(url).toPromise();
        return this.geoHttpService.callADKRtnResp(url, "get", null, null).toPromise();
    }
}
