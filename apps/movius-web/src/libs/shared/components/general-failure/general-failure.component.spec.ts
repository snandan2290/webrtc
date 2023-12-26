import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralFailureComponent } from './general-failure.component';

describe('GeneralFailureComponent', () => {
  let component: GeneralFailureComponent;
  let fixture: ComponentFixture<GeneralFailureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GeneralFailureComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GeneralFailureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
