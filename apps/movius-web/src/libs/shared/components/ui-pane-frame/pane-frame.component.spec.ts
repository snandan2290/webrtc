import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PaneFrameComponent } from './pane-frame.component';

describe('PaneFrameComponent', () => {
  let component: PaneFrameComponent;
  let fixture: ComponentFixture<PaneFrameComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PaneFrameComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PaneFrameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
