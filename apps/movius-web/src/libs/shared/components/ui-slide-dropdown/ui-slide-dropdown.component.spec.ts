import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UiSlideDropdownComponent } from './ui-slide-dropdown.component';

describe('UiSlideDropdownComponent', () => {
  let component: UiSlideDropdownComponent;
  let fixture: ComponentFixture<UiSlideDropdownComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ UiSlideDropdownComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UiSlideDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
