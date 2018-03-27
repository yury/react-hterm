// @flow
import type { RRowType, RNodeType, RAttributesType } from './model';
import { hterm, lib } from '../hterm_all.js';
import { genKey } from './utils';

var __cssStyleSheet = null;
const __defaultClassName = '';
const __defaultColor = '';

function __defaultAttributes(): RAttributesType {
  return {
    fc: __defaultColor,
    bc: __defaultColor,
    uc: __defaultColor,
    className: __defaultClassName,
    isDefault: true,
    wcNode: false,
    asciiNode: true,
  };
}

export function createNode(text: string, wcwidth: number): RNodeType {
  return {
    v: 0,
    txt: text,
    wcw: wcwidth,
    key: genKey(),
    attrs: __defaultAttributes(),
  };
}

hterm.TextAttributes.prototype.resetColorPalette = function() {
  this.colorPalette = lib.colors.colorPalette.concat();

  if (!__cssStyleSheet) {
    var style = document.createElement('style');
    style.type = 'text/css';
    this.document_.getElementsByTagName('head')[0].appendChild(style);
    __cssStyleSheet = style;
  }
  __cssStyleSheet.innerHTML = __generateAttributesStyleSheet(this);
  this.syncColors();
};

hterm.TextAttributes.prototype.createNode = function(
  text: string,
  wcwidth: number | void,
): RNodeType {
  var attrs = __defaultAttributes();

  attrs.isDefault = this.isDefault();

  if (!attrs.isDefault) {
    attrs.wcNode = this.wcNode;
    attrs.asciiNode = this.asciiNode;

    if (this.uri) {
      attrs.uri = this.uri;
    }
    if (this.uriId) {
      attrs.uriId = this.uriId;
    }
  }

  if (wcwidth === undefined) {
    if (this.asciiNode) {
      wcwidth = text.length;
    } else {
      wcwidth = lib.wc.strWidth(text);
    }
  }

  attrs.className = this.className;

  return {
    v: 0,
    txt: text,
    wcw: wcwidth,
    key: genKey(),
    attrs,
  };
};

hterm.TextAttributes.prototype.reset = function() {
  this.foregroundSource = this.SRC_DEFAULT;
  this.backgroundSource = this.SRC_DEFAULT;
  this.underlineSource = this.SRC_DEFAULT;
  this.foreground = this.DEFAULT_COLOR;
  this.background = this.DEFAULT_COLOR;
  this.underlineColor = this.DEFAULT_COLOR;
  this.bold = false;
  this.faint = false;
  this.italic = false;
  this.blink = false;
  this.underline = false;
  this.strikethrough = false;
  this.inverse = false;
  this.invisible = false;
  this.wcNode = false;
  this.asciiNode = true;
  this.uri = null;
  this.uriId = null;
  this.className = __defaultClassName;
};

hterm.TextAttributes.prototype.syncColors = function() {
  function getBrightIndex(i) {
    if (i < 8) {
      // If the color is from the lower half of the ANSI 16, add 8.
      return i + 8;
    }

    // If it's not from the 16 color palette, ignore bold requests.  This
    // matches the behavior of gnome-terminal.
    return i;
  }

  var foregroundSource = this.foregroundSource;
  var backgroundSource = this.backgroundSource;
  var defaultForeground = this.DEFAULT_COLOR;
  var defaultBackground = this.DEFAULT_COLOR;

  if (this.inverse) {
    foregroundSource = this.backgroundSource;
    backgroundSource = this.foregroundSource;
    // We can't inherit the container's color anymore.
    defaultForeground = this.defaultBackground;
    defaultBackground = this.defaultForeground;
  }

  if (this.enableBoldAsBright && this.bold) {
    if (Number.isInteger(foregroundSource)) {
      foregroundSource = getBrightIndex(foregroundSource);
    }
  }

  if (foregroundSource === this.SRC_DEFAULT) {
    this.foreground = defaultForeground;
  } else {
    this.foreground = foregroundSource;
  }

  if (this.faint) {
    if (Number.isInteger(this.foreground)) {
      this.foreground = this.colorPalette[this.foreground];
    }
    var colorToMakeFaint =
      this.foreground === this.DEFAULT_COLOR
        ? this.defaultForeground
        : this.foreground;
    this.foreground = lib.colors.mix(colorToMakeFaint, 'rgb(0, 0, 0)', 0.3333);
  }

  if (backgroundSource === this.SRC_DEFAULT) {
    this.background = defaultBackground;
  } else {
    this.background = backgroundSource;
  }

  // Process invisible settings last to keep it simple.
  if (this.invisible) {
    this.foreground = this.background;
  }

  if (this.underlineSource === this.SRC_DEFAULT) {
    this.underlineColor = this.DEFAULT_COLOR;
  } else {
    this.underlineColor = this.underlineSource;
  }

  this.className = __generateClassName(this);
};

var __c = []; // foreground color
var __bc = []; // background color
var __uc = []; // underline color
var __b = 'b'; // bold
var __bl = 'bl'; // blink
var __s = 's'; // blink
var __u = {
  solid: 'u1',
  double: 'u2',
  wavy: 'u3',
  dotted: 'u4',
  dashed: 'u5',
}; // underline
var __i = 'i'; // italic
var __invisible = 'invbl'; // invisible
var __wc = 'wc'; // widechar

for (var i = 0; i < 256; i++) {
  __c[i] = 'c' + i;
  __bc[i] = 'bc' + i;
  __uc[i] = 'uc' + i;
}

function __generateAttributesStyleSheet(attrs: hterm.TextAttributes): string {
  var rows = [];
  for (var i = 0; i < 256; i++) {
    var color = attrs.colorPalette[i];
    rows.push('span.c' + i + ' { color: ' + color + ';}');
    rows.push('span.bc' + i + ' { background: ' + color + ';}');
    rows.push('span.uc' + i + ' { text-decoration-color: ' + color + ';}');
  }
  rows.push('.u { text-decoration: underline;}');
  //solid: 'u1',
  //double: 'u2',
  //wavy: 'u3',
  //dotted: 'u4',
  //dashed: 'u5',
  rows.push('span.b { font-weight: bold;}');
  rows.push('span.i { font-style: italic;}');
  rows.push('span.wc { display: inline-block; overflow-x:hidden; }');
  for (var i = 0; i < 300; i++) {
    rows.push(
      'span.wc' +
        i +
        ' { width: calc(var(--hterm-charsize-width) * ' +
        i +
        ');}',
    );
  }
  return rows.join('\n');
}

var __classNameMemory = new Map();

function __generateClassName(attrs: hterm.TextAttributes): string {
  var result = [];

  if (attrs.foreground < 256 && attrs.foreground != '') {
    result.push(__c[attrs.foreground]);
  }
  if (attrs.background < 256 && attrs.background != '') {
    result.push(__bc[attrs.background]);
  }
  if (attrs.underlineColor < 256 && attrs.underlineColor != '') {
    result.push(__uc[attrs.underlineColor]);
  }

  if (attrs.enableBold && attrs.bold) {
    result.push(__b);
  }
  if (attrs.italic) {
    result.push(__i);
  }
  if (attrs.blink) {
    result.push(__bl);
  }
  if (attrs.underline) {
    result.push(__u[attrs.underline]);
  }
  if (attrs.strikethrough) {
    result.push(__s);
  }
  if (attrs.invisible) {
    result.push(__invisible);
  }

  if (result.length) {
    var name = result.join(' ');
    var cached = __classNameMemory.get(name);
    if (cached) {
      return cached;
    }
    if (__classNameMemory.size < 1000) {
      __classNameMemory.set(name, name);
    }
    return name;
  }
  return __defaultClassName;
}

hterm.TextAttributes.prototype.matchesNode = function(
  node: RNodeType,
): boolean {
  var attrs = node.attrs;

  if (attrs.isDefault) {
    return this.isDefault();
  }

  // We don't want to put multiple characters in a wcNode or a tile.
  // See the comments in createNode.
  // For attributes that default to false, we do not require that obj have them
  // declared, so always normalize them using !! (to turn undefined into false)
  // in the compares below.
  return (
    !(this.wcNode || attrs.wcNode) &&
    //!(this.tileData != null || attrs.tileData) &&
    this.className === attrs.className &&
    this.uriId === attrs.uriId
  );
};
