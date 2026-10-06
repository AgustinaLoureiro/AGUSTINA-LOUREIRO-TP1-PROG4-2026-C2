import { ComponentFixture, TestBed } from '@angular/core/testing';
import { proveedoresDePrueba } from '../../utils/pruebas';
import { Empleado } from './empleado';

describe('Empleado', () => {
  let component: Empleado;
  let fixture: ComponentFixture<Empleado>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Empleado],
      providers: proveedoresDePrueba,
    }).compileComponents();

    fixture = TestBed.createComponent(Empleado);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
