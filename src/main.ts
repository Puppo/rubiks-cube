import './style.css';
import { AppController } from './ui/AppController';

const appRoot = document.querySelector<HTMLElement>('#app');
if (appRoot) {
  const controller = new AppController(appRoot);
  void controller;
}
