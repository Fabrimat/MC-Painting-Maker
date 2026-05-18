import './app.css';
import { recoverIfStaleSWNavigation } from './pwa/register';
import { initIncomingFiles } from './pwa/incomingFiles';
import { initInstallTracking } from './pwa/installTracking';
import { mount } from 'svelte';
import App from './App.svelte';

void recoverIfStaleSWNavigation();
initIncomingFiles();
initInstallTracking();

const app = mount(App, { target: document.getElementById('app')! });
export default app;
