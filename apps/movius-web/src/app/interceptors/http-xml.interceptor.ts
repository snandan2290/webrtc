import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandler,
    HttpInterceptor,
    HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { get } from 'lodash/fp';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { parseStringPromise } from 'xml2js';

const parseBody = async (body: string) => {
    const jsonRes = await parseStringPromise(body, {
        explicitArray: false,
    });
    let apiReturnCode = +get(['root', 'return'], jsonRes);
    if (isNaN(apiReturnCode)) {
        apiReturnCode = +get(['root', 'return', '_'], jsonRes);
    }
    if (apiReturnCode !== 0) {
        const message = get(['root', 'desc'], jsonRes);
        const redirect = get(['root', 'sso_url'], jsonRes);
        const error = new HttpErrorResponse({
            status: 500,
            statusText: message,
            error: {
                apiReturnCode,
                message,
                redirect
            },
        });
        return { jsonRes, error };
    } else {
        return { jsonRes, error: null };
    }
};

/**
 * Convert json rest to xml rest
 */
@Injectable()
export class HttpXmlInterceptor implements HttpInterceptor {
    constructor() {}

    intercept(
        request: HttpRequest<any>,
        next: HttpHandler
    ): Observable<HttpEvent<any>> {
        if (request.urlWithParams.indexOf('ver=1') !== -1) {
            return next.handle(request).pipe(
                catchError(async (err) => {
                    const strError = err['error'];
                    if (typeof strError === 'string') {
                        const { error } = await parseBody(strError);
                        throw error;
                    } else {
                        throw new HttpErrorResponse({
                            status: 500,
                            statusText: 'Unknown Error',
                            error: {
                                apiReturnCode: 500,
                                message: 'Unknown Error',
                            },
                        });
                    }
                })) as any;
        } else {
            let headers = request.headers;

            if (headers.get('request-meta') !== 'json/xml') {
                // ver=json/xml means request in json but response in xml
                if (!request.url.includes('upload_mms') && sessionStorage.getItem("isLogingViaTeams") === "true") {
                    headers = headers.set(
                        'Content-Type',
                        'application/xml; charset=utf-8'
                    );
                }
               
            }
            headers = headers.delete('request-meta');
            request = request.clone({
                responseType: 'text',
                headers,
            });

            return next.handle(request).pipe(
                catchError(async (err) => {
                    const strError = err['error'];
                    if (typeof strError === 'string') {
                        const { error } = await parseBody(strError);
                        throw error;
                    } else {
                        throw new HttpErrorResponse({
                            status: 500,
                            statusText: 'Unknown Error',
                            error: {
                                apiReturnCode: 500,
                                message: 'Unknown Error',
                            },
                        });
                    }
                }),
                switchMap(async (res) => {
                    if (res.type === 4) {
                        const { jsonRes, error } = await parseBody(res['body']);
                        if (!!error) {
                            throw error;
                        } else {
                            res['body'] = jsonRes;
                            return res;
                        }
                    } else {
                        return res;
                    }
                })
            ) as any;
        }
    }
}
