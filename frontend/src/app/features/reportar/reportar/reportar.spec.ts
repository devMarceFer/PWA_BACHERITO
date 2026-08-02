import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportarComponent } from './reportar';

describe('ReportarComponent', () => {
  let component: ReportarComponent;
  let fixture: ComponentFixture<ReportarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
