/**
 * Scholium Plot for Supernote.
 *
 * Two buttons: one on the NOTE/DOC toolbar, one on the lasso toolbar. The
 * lasso one places the figure under what you selected, and can read the
 * equation you wrote there.
 */
import { AppRegistry, Image } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { PluginManager } from 'sn-plugin-lib';
import { setLaunch } from './src/ui/store';

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

const icon = Image.resolveAssetSource(require('./assets/button.png')).uri;
const lassoIcon = Image.resolveAssetSource(require('./assets/button-lasso.png')).uri;

const TOOLBAR = 1, LASSO = 2;

PluginManager.registerButton(1, ['NOTE', 'DOC'], { id: TOOLBAR, name: 'Plot', icon, showType: 1 });
PluginManager.registerButton(2, ['NOTE', 'DOC'], {
  id: LASSO, name: 'Plot', icon: lassoIcon, showType: 1,
  // strokes, titles, pictures, text, links, geometry: show the button for any selection
  editDataTypes: [0, 1, 2, 3, 4, 5],
});

PluginManager.registerButtonListener({
  onButtonPress(event) {
    setLaunch(event.id === LASSO ? 'lasso' : 'toolbar');
  },
});
