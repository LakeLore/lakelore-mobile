import { registerRootComponent } from 'expo';

// Initialize Sentry FIRST so any error during App startup is captured.
import { initSentry } from './src/sentry';
initSentry();

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
