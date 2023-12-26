import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactSyncGainComponent } from './contact-sync-gain.component';

describe('ContactSyncGainComponent', () => {
  let component: ContactSyncGainComponent;
  let fixture: ComponentFixture<ContactSyncGainComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ContactSyncGainComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactSyncGainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
