import { createRouter, createWebHistory } from "vue-router";
import HomeView from "@/views/HomeView.vue";
import AnnotateView from "@/views/AnnotateView.vue";

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/annotate',
    name: 'Annotate',
    component: AnnotateView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;