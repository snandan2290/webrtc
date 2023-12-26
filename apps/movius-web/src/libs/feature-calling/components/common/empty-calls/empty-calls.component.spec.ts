import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyCallsComponent } from './empty-calls.component';

describe('EmptyCallsComponent', () => {
  let component: EmptyCallsComponent;
  let fixture: ComponentFixture<EmptyCallsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EmptyCallsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EmptyCallsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
