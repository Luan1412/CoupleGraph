import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryExpenses } from './category-expenses';

describe('CategoryExpenses', () => {
  let component: CategoryExpenses;
  let fixture: ComponentFixture<CategoryExpenses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryExpenses],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryExpenses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
