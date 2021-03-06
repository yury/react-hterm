// @flow

import type { RRowType } from './model';

import { hterm, lib } from '../hterm_all.js';
import { touch, rowWidth, rowText, genKey } from './utils';
import { createDefaultNode } from './TextAttributes';

hterm.Terminal.prototype.decorate = function(div) {
  this.div_ = document.body;

  this.accessibilityReader_ = new hterm.AccessibilityReader(div);
  this.scrollPort_.decorate(div);
  this.scrollPort_.setUserCssUrl(this.prefs_.get('user-css'));
  this.scrollPort_.setUserCssText(this.prefs_.get('user-css-text'));

  this.div_.focus = this.focus.bind(this);

  this.setFontSize(this.prefs_.get('font-size'));
  this.syncFontFamily();

  this.setScrollbarVisible(this.prefs_.get('scrollbar-visible'));
  this.setScrollWheelMoveMultipler(
    this.prefs_.get('scroll-wheel-move-multiplier'),
  );

  this.document_ = this.scrollPort_.getDocument();

  this.document_.body.oncontextmenu = function() {
    return false;
  };

  var onMouse = this.onMouse_.bind(this);
  var screenNode = this.scrollPort_.getScreenNode();
  screenNode.addEventListener('mousedown', onMouse);
  screenNode.addEventListener('mouseup', onMouse);
  screenNode.addEventListener('mousemove', onMouse);
  this.scrollPort_.onScrollWheel = onMouse;

  screenNode.addEventListener('focus', this.onFocusChange_.bind(this, true));
  // Listen for mousedown events on the screenNode as in FF the focus
  // events don't bubble.
  screenNode.addEventListener(
    'mousedown',
    function() {
      setTimeout(this.onFocusChange_.bind(this, true));
    }.bind(this),
  );

  screenNode.addEventListener('blur', this.onFocusChange_.bind(this, false));

  var style = this.document_.createElement('style');
  style.textContent =
    '.cursor-node[focus="false"] {' +
    '  box-sizing: border-box;' +
    '  background-color: transparent !important;' +
    '  border-width: 2px;' +
    '  border-style: solid;' +
    '}' +
    '.wc-node {' +
    '  display: inline-block;' +
    '  text-align: center;' +
    '  width: calc(var(--hterm-charsize-width) * 2);' +
    '  line-height: var(--hterm-charsize-height);' +
    '}' +
    ':root {' +
    '  --hterm-charsize-width: ' +
    this.scrollPort_.characterSize.width +
    'px;' +
    '  --hterm-charsize-height: ' +
    this.scrollPort_.characterSize.height +
    'px;' +
    // Default position hides the cursor for when the window is initializing.
    '  --hterm-cursor-offset-col: -1;' +
    '  --hterm-cursor-offset-row: -1;' +
    '  --hterm-blink-node-duration: 0.7s;' +
    '  --hterm-mouse-cursor-text: text;' +
    '  --hterm-mouse-cursor-pointer: default;' +
    '  --hterm-mouse-cursor-style: var(--hterm-mouse-cursor-text);' +
    '}' +
    '.uri-node:hover {' +
    '  text-decoration: underline;' +
    '  cursor: pointer;' +
    '}' +
    '@keyframes blink {' +
    '  from { opacity: 1.0; }' +
    '  to { opacity: 0.0; }' +
    '}' +
    '.blink-node {' +
    '  animation-name: blink;' +
    '  animation-duration: var(--hterm-blink-node-duration);' +
    '  animation-iteration-count: infinite;' +
    '  animation-timing-function: ease-in-out;' +
    '  animation-direction: alternate;' +
    '}';
  this.document_.head.appendChild(style);

  this.cursorOverlayNode_ = this.document_.createElement('div');
  this.cursorOverlayNode_.id = 'hterm:terminal-overlay-cursor';
  this.cursorOverlayNode_.style.cssText =
    'position: absolute;' +
    'left: 0;' +
    'top: 0;' +
    'bottom: 0;' +
    'right: 0;' +
    'pointer-events: none;';

  this.document_.body.appendChild(this.cursorOverlayNode_);

  this.cursorNode_ = this.document_.createElement('div');
  this.cursorNode_.id = 'hterm:terminal-cursor';
  this.cursorNode_.className = 'cursor-node';
  this.cursorNode_.style.cssText =
    'position: absolute;' +
    //'left: calc(var(--hterm-charsize-width) * var(--hterm-cursor-offset-col));' +
    //'top: calc(var(--hterm-charsize-height) * var(--hterm-cursor-offset-row));' +
    'display: ' +
    (this.options_.cursorVisible ? '' : 'none') +
    ';' +
    'width: var(--hterm-charsize-width);' +
    'height: var(--hterm-charsize-height);' +
    'background-color: var(--hterm-cursor-color);' +
    'border-color: var(--hterm-cursor-color);' +
    '  isolatation: isolate;' +
    '  transform: translate3d(calc(var(--hterm-charsize-width) * var(--hterm-cursor-offset-col)), calc(var(--hterm-charsize-height) * var(--hterm-cursor-offset-row)), 0);' +
    '-webkit-transition: opacity, background-color 100ms linear;' +
    '-moz-transition: opacity, background-color 100ms linear;';

  this.setCursorColor();
  this.setCursorBlink(!!this.prefs_.get('cursor-blink'));
  this.restyleCursor_();

  this.cursorOverlayNode_.appendChild(this.cursorNode_);

  this.ime_ = this.document_.createElement('ime');
  this.cursorOverlayNode_.appendChild(this.ime_);

  // When 'enableMouseDragScroll' is off we reposition this element directly
  // under the mouse cursor after a click.  This makes Chrome associate
  // subsequent mousemove events with the scroll-blocker.  Since the
  // scroll-blocker is a peer (not a child) of the scrollport, the mousemove
  // events do not cause the scrollport to scroll.
  //
  // It's a hack, but it's the cleanest way I could find.
  this.scrollBlockerNode_ = this.document_.createElement('div');
  this.scrollBlockerNode_.id = 'hterm:mouse-drag-scroll-blocker';
  this.scrollBlockerNode_.style.cssText =
    'position: absolute;' +
    'top: -99px;' +
    'display: block;' +
    'width: 10px;' +
    'height: 10px;';
  this.document_.body.appendChild(this.scrollBlockerNode_);

  this.scrollPort_.onScrollWheel = onMouse;
  ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick'].forEach(
    function(event) {
      this.scrollBlockerNode_.addEventListener(event, onMouse);
      this.cursorNode_.addEventListener(event, onMouse);
      this.document_.addEventListener(event, onMouse);
    }.bind(this),
  );

  this.cursorNode_.addEventListener(
    'mousedown',
    function() {
      setTimeout(this.focus.bind(this));
    }.bind(this),
  );

  this.setReverseVideo(false);

  this.scrollPort_.focus();
  this.scrollPort_.scheduleRedraw();
};

hterm.Terminal.prototype.syncCursorPosition_ = function() {
  var topRowIndex = this.scrollPort_.getTopRowIndex();
  var bottomRowIndex = this.scrollPort_.getBottomRowIndex(topRowIndex);
  var cursorRowIndex =
    this.scrollbackRows_.length + this.screen_.cursorPosition.row;

  if (cursorRowIndex > bottomRowIndex) {
    // Cursor is scrolled off screen, move it outside of the visible area.
    //this.setCssCursorPos({ row: -1, col: this.screen_.cursorPosition.column });
    this.setCssCursorPos({ row: -1, col: -1 });
    return;
  }

  if (this.options_.cursorVisible && this.cursorNode_.style.display == 'none') {
    // Re-display the terminal cursor if it was hidden by the mouse cursor.
    this.cursorNode_.style.display = '';
  }

  this.setCssCursorPos({
    row: cursorRowIndex - topRowIndex + this.scrollPort_.visibleRowTopMargin,
    col: this.screen_.cursorPosition.column,
  });

  // Update the caret for a11y purposes.
  var selection = this.document_.getSelection();
  if (selection && selection.isCollapsed)
    this.screen_.syncSelectionCaret(selection);
};

var __prevCursorPos = { row: -1, col: -1 };

hterm.Terminal.prototype.setCssCursorPos = function(pos: {
  row: number,
  col: number,
}) {
  if (__prevCursorPos.row === pos.row && __prevCursorPos.col === pos.col) {
    return;
  }

  if (__prevCursorPos.row === -1 && pos.row === -1) {
    return;
  }

  if (__prevCursorPos.row !== pos.row) {
    this.setCursorCssVar('cursor-offset-row', pos.row + '');
  }

  if (__prevCursorPos.col !== pos.col) {
    this.setCursorCssVar('cursor-offset-col', pos.col + '');
  }
  __prevCursorPos = pos;
};

hterm.Terminal.prototype.setCursorCssVar = function(
  name,
  value,
  opt_prefix = '--hterm-',
) {
  this.cursorOverlayNode_.style.setProperty(`${opt_prefix}${name}`, value);
};

hterm.Terminal.prototype.scheduleSyncCursorPosition_ = function() {
  if (this.timeouts_.syncCursor) {
    return;
  }

  var self = this;
  this.timeouts_.syncCursor = setTimeout(function() {
    requestAnimationFrame(function() {
      self.syncCursorPosition_();
      self.timeouts_.syncCursor = 0;
    });
  }, 0);
};

hterm.Terminal.prototype.scheduleRedraw_ = function() {
  if (this.timeouts_.redraw) {
    return;
  }

  var self = this;
  this.timeouts_.redraw = setTimeout(function() {
    self.timeouts_.redraw = 0;
    self.scrollPort_.redraw_();
  }, 0);
};

hterm.Terminal.prototype.scheduleScrollDown_ = function() {
  if (this.timeouts_.scrollDown) {
    return;
  }

  var self = this;
  this.timeouts_.scrollDown = setTimeout(function() {
    self.timeouts_.scrollDown = 0;
    self.scrollPort_.scrollToBottom();
  }, 20);
};

hterm.Terminal.prototype.renumberRows_ = function(start, end, opt_screen) {
  var screen = opt_screen || this.screen_;

  var offset = this.scrollbackRows_.length;
  var rows = screen.rowsArray;
  for (var i = start; i < end; i++) {
    var row = rows[i];
    row.n = offset + i;
    touch(row);
  }
};

hterm.Terminal.prototype.appendRows_ = function(count) {
  var needScrollSync = false;
  if (this.scrollbackRows_.length > 6000) {
    this.scrollbackRows_.splice(0, 2000);
    needScrollSync = true;
  }

  var cursorRow = this.screen_.rowsArray.length;
  var offset = this.scrollbackRows_.length + cursorRow;
  for (var i = 0; i < count; i++) {
    var row: RRowType = {
      key: genKey(),
      n: offset + i,
      o: false,
      v: 0,
      nodes: [createDefaultNode('', 0)],
    };
    this.screen_.setRow(row, cursorRow + i);
  }

  var extraRows = this.screen_.rowsArray.length - this.screenSize.height;
  if (extraRows > 0) {
    var ary = this.screen_.shiftRows(extraRows);
    Array.prototype.push.apply(this.scrollbackRows_, ary);
    if (this.scrollPort_.isScrolledEnd) this.scheduleScrollDown_();
  }

  if (needScrollSync) {
    this.scrollPort_.syncScrollHeight();
    //if (this.scrollPort_.isScrolledEnd) {
    this.scheduleScrollDown_();
    //}
  }

  if (cursorRow >= this.screen_.rowsArray.length)
    cursorRow = this.screen_.rowsArray.length - 1;

  this.setAbsoluteCursorPosition(cursorRow, 0);
};

hterm.Terminal.prototype.moveRows_ = function(fromIndex, count, toIndex) {
  var ary = this.screen_.removeRows(fromIndex, count);
  this.screen_.insertRows(toIndex, ary);

  var start, end;
  if (fromIndex < toIndex) {
    start = fromIndex;
    end = toIndex + count;
  } else {
    start = toIndex;
    end = fromIndex + count;
  }

  this.renumberRows_(start, end);
  this.scrollPort_.scheduleInvalidate();
};

hterm.Terminal.prototype.eraseToLeft = function() {
  var cursor = this.saveCursor();
  this.setCursorColumn(0);
  const count = cursor.column + 1;
  this.screen_.overwriteString(lib.f.getWhitespace(count), count);
  this.scrollPort_.renderRef.touchRow(this.screen_.cursorRow());
  this.restoreCursor(cursor);
};

hterm.Terminal.prototype.eraseToRight = function(opt_count) {
  if (this.screen_.cursorPosition.overflow) {
    return;
  }

  var maxCount = this.screenSize.width - this.screen_.cursorPosition.column;
  var count = opt_count ? Math.min(opt_count, maxCount) : maxCount;
  var cursorRow = this.screen_.rowsArray[this.screen_.cursorPosition.row];

  if (
    this.screen_.textAttributes.background ===
    this.screen_.textAttributes.DEFAULT_COLOR
  ) {
    if (rowWidth(cursorRow) <= this.screen_.cursorPosition.column + count) {
      this.screen_.deleteChars(count);
      this.clearCursorOverflow();
      this.scrollPort_.renderRef.touchRow(cursorRow);
      return;
    }
  }

  var cursor = this.saveCursor();
  this.screen_.overwriteString(lib.f.getWhitespace(count), count);
  this.scrollPort_.renderRef.touchRow(cursorRow);
  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

hterm.Terminal.prototype.insertLines = function(count) {
  var cursorRow = this.screen_.cursorPosition.row;

  var bottom = this.getVTScrollBottom();
  count = Math.min(count, bottom - cursorRow);

  // The moveCount is the number of rows we need to relocate to make room for
  // the new row(s).  The count is the distance to move them.
  var moveCount = bottom - cursorRow - count + 1;
  if (moveCount) {
    this.moveRows_(cursorRow, moveCount, cursorRow + count);
  }

  for (var i = count - 1; i >= 0; i--) {
    this.setAbsoluteCursorPosition(cursorRow + i, 0);
    this.screen_.clearCursorRow();
    this.scrollPort_.renderRef.touchRow(this.screen_.cursorRow());
  }
};

hterm.Terminal.prototype.deleteLines = function(count) {
  var cursor = this.saveCursor();

  var top = cursor.row;
  var bottom = this.getVTScrollBottom();

  var maxCount = bottom - top + 1;
  count = Math.min(count, maxCount);

  var moveStart = bottom - count + 1;
  if (count != maxCount) this.moveRows_(top, count, moveStart);

  for (var i = 0; i < count; i++) {
    this.setAbsoluteCursorPosition(moveStart + i, 0);
    this.screen_.clearCursorRow();
    var cursorRow = this.screen_.cursorRow();
    this.scrollPort_.renderRef.touchRow(cursorRow);
  }

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

hterm.Terminal.prototype.insertSpace = function(count) {
  var cursor = this.saveCursor();

  var ws = lib.f.getWhitespace(count || 1);
  this.screen_.insertString(ws, ws.length);
  this.screen_.maybeClipCurrentRow();
  var cursorRow = this.screen_.cursorRow();
  this.scrollPort_.renderRef.touchRow(cursorRow);

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

hterm.Terminal.prototype.deleteChars = function(count) {
  var deleted = this.screen_.deleteChars(count);
  if (deleted && !this.screen_.textAttributes.isDefault()) {
    var cursor = this.saveCursor();
    this.setCursorColumn(this.screenSize.width - deleted);
    this.screen_.insertString(lib.f.getWhitespace(deleted), deleted);
    this.restoreCursor(cursor);
  }
  var cursorRow = this.screen_.cursorRow();
  this.scrollPort_.renderRef.touchRow(cursorRow);

  this.clearCursorOverflow();
};

hterm.Terminal.prototype.eraseAbove = function() {
  var cursor = this.saveCursor();

  this.eraseToLeft();

  for (var i = 0; i < cursor.row; i++) {
    this.setAbsoluteCursorPosition(i, 0);
    this.screen_.clearCursorRow();
    var cursorRow = this.screen_.cursorRow();
    touch(cursorRow);
    this.scrollPort_.renderRef.touchRow(cursorRow);
  }

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

hterm.Terminal.prototype.eraseLine = function() {
  var cursor = this.saveCursor();
  this.screen_.clearCursorRow();
  this.restoreCursor(cursor);
  this.clearCursorOverflow();
  this.scrollPort_.renderRef.touchRow(this.screen_.cursorRow());
};

hterm.Terminal.prototype.fill = function(ch) {
  var cursor = this.saveCursor();

  this.setAbsoluteCursorPosition(0, 0);
  for (var row = 0; row < this.screenSize.height; row++) {
    for (var col = 0; col < this.screenSize.width; col++) {
      this.setAbsoluteCursorPosition(row, col);
      this.screen_.overwriteString(ch, 1);
    }
  }

  this.restoreCursor(cursor);
  this.scrollPort_.renderRef.touch();
};

hterm.Terminal.prototype.clearHome = function(opt_screen) {
  var screen = opt_screen || this.screen_;
  var bottom = screen.getHeight();

  if (bottom === 0) {
    // Empty screen, nothing to do.
    return;
  }

  for (var i = 0; i < bottom; i++) {
    screen.setCursorPosition(i, 0);
    screen.clearCursorRow();
    var cursorRow = this.screen_.cursorRow();
    this.scrollPort_.renderRef.touchRow(cursorRow);
  }

  screen.setCursorPosition(0, 0);
};

hterm.Terminal.prototype.eraseBelow = function() {
  var cursor = this.saveCursor();

  this.eraseToRight();

  var bottom = this.screenSize.height - 1;
  for (var i = cursor.row + 1; i <= bottom; i++) {
    this.setAbsoluteCursorPosition(i, 0);
    this.screen_.clearCursorRow();
    var cursorRow = this.screen_.cursorRow();
    this.scrollPort_.renderRef.touchRow(cursorRow);
  }

  this.restoreCursor(cursor);
  this.clearCursorOverflow();
};

function debugPrint(screen: hterm.Screen, str: string) {
  var loc = [screen.cursorPosition.row, screen.cursorPosition.column];
  var attrs = screen.textAttributes;
  console.log(
    `print([${loc[0]}, ${loc[1]}], ${JSON.stringify(str)}, ${JSON.stringify(
      attrs.attrs(),
    )})`,
  );
}

hterm.Terminal.prototype.print = function(str) {
  var startOffset = 0;

  var strWidth = lib.wc.strWidth(str);
  // Fun edge case: If the string only contains zero width codepoints (like
  // combining characters), we make sure to iterate at least once below.
  if (strWidth === 0 && str) {
    strWidth = 1;
  }

  while (startOffset < strWidth) {
    if (this.options_.wraparound && this.screen_.cursorPosition.overflow) {
      this.screen_.commitLineOverflow();
      this.newLine();
    }

    var count = strWidth - startOffset;
    var didOverflow = false;
    var substr;

    if (this.screen_.cursorPosition.column + count >= this.screenSize.width) {
      didOverflow = true;
      count = this.screenSize.width - this.screen_.cursorPosition.column;
    }

    if (didOverflow && !this.options_.wraparound) {
      // If the string overflowed the line but wraparound is off, then the
      // last printed character should be the last of the string.
      // TODO: This will add to our problems with multibyte UTF-16 characters.
      substr =
        lib.wc.substr(str, startOffset, count - 1) +
        lib.wc.substr(str, strWidth - 1);
      count = strWidth;
    } else {
      substr = lib.wc.substr(str, startOffset, count);
    }

    var textAttributes = this.screen_.textAttributes;
    var tokens = hterm.TextAttributes.splitWidecharString(substr);
    var len = tokens.length;
    for (var i = 0; i < len; i++) {
      var token = tokens[i];
      textAttributes.wcNode = token.wcNode;
      textAttributes.asciiNode = token.asciiNode;

      if (this.options_.insertMode) {
        this.screen_.insertString(token.str, token.wcStrWidth);
      } else {
        //debugPrint(this.screen_, token);
        this.screen_.overwriteString(token.str, token.wcStrWidth);
      }
      textAttributes.wcNode = false;
      textAttributes.asciiNode = true;
    }

    this.screen_.maybeClipCurrentRow();
    startOffset += count;

    this.scrollPort_.renderRef.touchRow(this.screen_.cursorRow());
  }

  //this.scheduleSyncCursorPosition_();

  if (this.scrollOnOutput_) {
    this.scrollPort_.scrollRowToBottom(this.getRowCount());
  }
};

hterm.Terminal.prototype.interpret = function(str) {
  this.vt.interpret(str);
  // this.scheduleSyncCursorPosition_();
};

hterm.Terminal.prototype.setFontSize = function(px) {
  if (px <= 0) px = this.prefs_.get('font-size');

  if (this.cursorOverlayNode_) {
    this.cursorOverlayNode_.style.fontSize = px + 'px';
  }
  this.scrollPort_.setFontSize(px);
  this.setCssVar('charsize-width', this.scrollPort_.characterSize.width + 'px');
  this.setCssVar(
    'charsize-height',
    this.scrollPort_.characterSize.height + 'px',
  );
};

hterm.Terminal.prototype.syncFontFamily = function() {
  const fontFamily = this.prefs_.get('font-family');
  if (this.cursorOverlayNode_) {
    this.cursorOverlayNode_.style.fontFamily = fontFamily;
  }
  this.scrollPort_.setFontFamily(fontFamily, this.prefs_.get('font-smoothing'));
  this.syncBoldSafeState();
};

hterm.Terminal.prototype.displayImage = function(options) {
  // Make sure we're actually given a resource to display.
  if (options.uri === undefined) return;

  // Set up the defaults to simplify code below.
  if (!options.name) options.name = '';

  // See if we should show this object directly, or download it.
  if (options.inline) {
    const io = this.io.push();
    io.showOverlay(
      hterm.msg('LOADING_RESOURCE_START', [options.name], 'Loading $1 ...'),
      null,
    );

    // While we're loading the image, eat all the user's input.
    io.onVTKeystroke = io.sendString = () => {};

    // Initialize this new image.
    const img = this.document_.createElement('img');
    img.src = options.uri;
    img.title = img.alt = options.name;

    // Attach the image to the page to let it load/render.  It won't stay here.
    // This is needed so it's visible and the DOM can calculate the height.  If
    // the image is hidden or not in the DOM, the height is always 0.
    this.document_.body.appendChild(img);

    // Wait for the image to finish loading before we try moving it to the
    // right place in the terminal.
    img.onload = () => {
      // Parse a width/height specification.
      const parseDim = (dim, maxDim, cssVar) => {
        if (!dim || dim == 'auto') return '';

        const ary = dim.match(/^([0-9]+)(px|%)?$/);
        if (ary) {
          if (ary[2] == '%') return (maxDim * parseInt(ary[1])) / 100 + 'px';
          else if (ary[2] == 'px') return dim;
          else return `calc(${dim} * var(${cssVar}))`;
        }

        return '';
      };
      img.style.width = parseDim(
        options.width,
        this.document_.body.clientWidth,
        '--hterm-charsize-width',
      );
      img.style.height = parseDim(
        options.height,
        this.document_.body.clientHeight,
        '--hterm-charsize-height',
      );

      // Figure out how many rows the image occupies, then add that many.
      // XXX: This count will be inaccurate if the font size changes on us.
      const padRows = Math.ceil(
        img.clientHeight / this.scrollPort_.characterSize.height,
      );
      for (let i = 0; i < padRows; ++i) this.newLine();

      // Update the max height in case the user shrinks the character size.

      // Move the image to the last row.  This way when we scroll up, it doesn't
      // disappear when the first row gets clipped.  It will disappear when we
      // scroll down and the last row is clipped ...
      this.document_.body.removeChild(img);
      // Create a wrapper node so we can do an absolute in a relative position.
      // This helps with rounding errors between JS & CSS counts.
      const row: RRowType = this.getRowNode(
        this.scrollbackRows_.length + this.getCursorRow() - 1,
      );
      row.img = {
        textAlign: options.align,
        padRows: padRows,
        objectFit: options.preserveAspectRatio ? 'scale-down' : 'fill',
        src: img.src,
        title: img.title,
        alt: img.alt,
        style: {
          positon: 'absolute',
          bottom: 'calc(0px - var(--hterm-charsize-height))',
        },
      };
      touch(row);
      this.scrollPort_.renderRef.touchRow(row);

      io.hideOverlay();
      io.pop();
    };

    // If we got a malformed image, give up.
    img.onerror = e => {
      this.document_.body.removeChild(img);
      io.showOverlay(
        hterm.msg(
          'LOADING_RESOURCE_FAILED',
          [options.name],
          'Loading $1 failed ...',
        ),
      );
      io.pop();
    };
  }
};

hterm.Terminal.prototype.getRowsText = function(start, end) {
  var ary = [];
  for (var i = start; i < end; i++) {
    var node = this.getRowNode(i);
    ary.push(rowText(node));
    if (i < end - 1 && !node.o) {
      ary.push('\n');
    }
  }

  return ary.join('');
};
