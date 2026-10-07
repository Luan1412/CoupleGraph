import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpacesWidget } from './spaces-widget';

describe('SpacesWidget', () => {
  let component: SpacesWidget;
  let fixture: ComponentFixture<SpacesWidget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpacesWidget],
    }).compileComponents();

    fixture = TestBed.createComponent(SpacesWidget);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
