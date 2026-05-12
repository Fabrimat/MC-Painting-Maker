import './app.css';
import './pwa/register';
import { initIncomingFiles } from './pwa/incomingFiles';
import { mount } from 'svelte';
import App from './App.svelte';

initIncomingFiles();

const app = mount(App, { target: document.getElementById('app')! });
export default app;
