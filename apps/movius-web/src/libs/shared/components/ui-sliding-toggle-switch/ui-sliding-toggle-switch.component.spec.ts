import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UiSlidingToggleSwitchComponent } from './ui-sliding-toggle-switch.component';

describe('UiSlidingToggleSwitchComponent', () => {
  let component: UiSlidingToggleSwitchComponent;
  let fixture: ComponentFixture<UiSlidingToggleSwitchComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ UiSlidingToggleSwitchComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UiSlidingToggleSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
