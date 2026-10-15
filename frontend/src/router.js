import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Approve from './views/Approve.vue';


const routes = [
  { path: '/', component: Login },
  { path: '/admin/ensani', component: Approve}
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;