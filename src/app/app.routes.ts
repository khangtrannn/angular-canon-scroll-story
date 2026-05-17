import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'canon-product',
  },
  {
    path: 'canon-product',
    loadComponent: () =>
      import('./canon-product/canon-product-page.component').then(
        (component) => component.CanonProductPageComponent,
      ),
  },
];
