import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Results from './views/Results.vue';


const routes = [
  { path: '/', component: Login },
  { path: '/results', component: Results}
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;