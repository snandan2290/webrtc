import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EmergencyTermsComponent } from './emergency-terms.component';

describe('EmergencyTermsComponent', () => {
  let component: EmergencyTermsComponent;
  let fixture: ComponentFixture<EmergencyTermsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EmergencyTermsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EmergencyTermsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
