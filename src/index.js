// @flow

import { hterm, lib } from './hterm_all';
require('./index.css');
require('./RScreen/hterm_vs.patched');
require('./RScreen/ScrollPort');
require('./RScreen/Screen');
require('./RScreen/Terminal');

window.hterm = hterm;
window.lib = lib;
/*
// If you are a cross-browser web app and want in-memory storage only.
hterm.defaultStorage = new lib.Storage.Memory();
const t = new hterm.Terminal();

t.onTerminalReady = function() {
  // Create a new terminal IO object and give it the foreground.
  // (The default IO object just prints warning messages about unhandled
  // things to the the JS console.)
  const io = t.io.push();

  io.onVTKeystroke = str => {
    // Do something useful with str here.
    // For example, Secure Shell forwards the string onto the NaCl plugin.
  };

  io.sendString = str => {
    // Just like a keystroke, except str was generated by the terminal itself.
    // For example, when the user pastes a string.
    // Most likely you'll do the same thing as onVTKeystroke.
  };

  io.onTerminalResize = (columns, rows) => {
    // React to size changes here.
    // Secure Shell pokes at NaCl, which eventually results in
    // some ioctls on the host.
  };

  // You can call io.push() to foreground a fresh io context, which can
  // be uses to give control of the terminal to something else.  When that
  // thing is complete, should call io.pop() to restore control to the
  // previous io object.
};

t.decorate(document.querySelector('#terminal'));

var i = 0;
var r = 0;
setInterval(function() {
  i++;
  t.io.print(i.toString());
  if (i > 1) {
    i = 0;
    t.io.println('\r\n\u001b[0;31m' + r + '\u001b[0m    nice  привет');
    r++;
  }
}, 1);
*/
