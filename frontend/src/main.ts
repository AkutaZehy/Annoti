import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles.css";
import "./styles/theme-light.css";
import "./styles/theme-dark.css";
import "./styles/markdown.css";

createApp(App).use(createPinia()).mount("#app");
