import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PwdStrengthComponent } from './pwd-strength.component';

describe('PwdStrengthComponent', () => {
  let component: PwdStrengthComponent;
  let fixture: ComponentFixture<PwdStrengthComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PwdStrengthComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PwdStrengthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
