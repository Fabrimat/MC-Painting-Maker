import './app.css';
import './pwa/register';
import { initIncomingFiles } from './pwa/incomingFiles';
import { initInstallTracking } from './pwa/installTracking';
import { mount } from 'svelte';
import App from './App.svelte';

initIncomingFiles();
initInstallTracking();

const app = mount(App, { target: document.getElementById('app')! });
export default app;
