import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Results from './views/Results.vue';
import AdminLogin from './views/AdminLogin.vue';
import AdminDashboard from './views/AdminDashboard.vue';
import HRPanel from './views/HRPanel.vue';
import ManagerPanel from './views/ManagerPanel.vue';


const routes = [
  { path: '/',                component: Login,           meta: { title: 'رایگیری' }},
  { path: '/results',         component: Results,         meta: { title: 'نتایج انتخابات' }},
  { path: '/admin/login',     component: AdminLogin,      meta: { title: 'ورود ادمین' }},
  { path: '/admin/dashboard', component: AdminDashboard,  meta: { title: 'پنل ادمین' }},
  { path: '/Manager_Panel',   component: ManagerPanel,    meta: { title: 'پنل مدیر' }},
  { path: '/HR_Panel',        component: HRPanel,         meta: { title: 'پنل مسئول انسانی' }}
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'سامانه انتخابات رستا';
  next();
});

export default router;