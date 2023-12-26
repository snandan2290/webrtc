import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddToExistingContactComponent } from './add-to-existing-contact.component';

describe('AddToExistingContactComponent', () => {
  let component: AddToExistingContactComponent;
  let fixture: ComponentFixture<AddToExistingContactComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddToExistingContactComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddToExistingContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
