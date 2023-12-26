import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UiSlideInputComponent } from './ui-slide-input.component';

describe('UiSlideInputComponent', () => {
  let component: UiSlideInputComponent;
  let fixture: ComponentFixture<UiSlideInputComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ UiSlideInputComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UiSlideInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
