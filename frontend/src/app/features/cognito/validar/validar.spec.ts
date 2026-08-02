import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ValidarComponent } from './validar';

describe('ValidarComponent', () => {
  let component: ValidarComponent;
  let fixture: ComponentFixture<ValidarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ValidarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
