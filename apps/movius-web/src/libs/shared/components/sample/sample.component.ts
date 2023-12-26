import { Component, OnInit } from '@angular/core';
import { Observable, of, merge, timer } from 'rxjs';
import { delay, mapTo, mergeMap, map } from 'rxjs/operators';

@Component({
  selector: 'movius-web-sample',
  templateUrl: './sample.component.html',
  styleUrls: ['./sample.component.scss']
})
export class SampleComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  $date = timer(0, 1000).pipe(map(e => (new Date()).toLocaleString()));

  $data = timer(0, 2000);

}
