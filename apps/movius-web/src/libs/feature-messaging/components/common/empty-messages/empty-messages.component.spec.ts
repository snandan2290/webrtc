import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyMessagesComponent } from './empty-messages.component';

describe('EmptyMessagesComponent', () => {
  let component: EmptyMessagesComponent;
  let fixture: ComponentFixture<EmptyMessagesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EmptyMessagesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EmptyMessagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
