import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Results from './views/Results.vue';
import AdminLogin from './views/AdminLogin.vue';
import AdminDashboard from './views/AdminDashboard.vue';

// Dummy components for panels
const ManagerPanel = { template: '<div><h1>Manager Panel</h1><p>Restricted access.</p></div>' };
const HRPanel = { template: '<div><h1>HR Panel</h1><p>Restricted access.</p></div>' };

const routes = [
  { path: '/', component: Login },
  { path: '/results', component: Results },
  { path: '/admin/login', component: AdminLogin },
  { path: '/admin/dashboard', component: AdminDashboard },
  { path: '/Manager_Panel', component: ManagerPanel },
  { path: '/HR_Panel', component: HRPanel }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;