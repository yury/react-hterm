// @flow

import React from 'react';
import ReactDOM from 'react-dom';
import type { RRowType } from './model';
import RRow from './RRow';

export default class RRowList extends React.Component<*> {
  _dirty = true;
  _rows: RRowType[] = [];
  _rowsMap: Map<number, any> = new Map();

  render() {
    const rows = this._rows;
    const len = rows.length;
    const elements = new Array(len);
    this._rowsMap = new Map();
    for (var i = 0; i < len; i++) {
      const row = rows[i];
      const ref = React.createRef();
      this._rowsMap.set(row.key, ref);
      elements[i] = React.createElement(RRow, {
        key: row.key,
        ref: ref,
        row: row,
      });
    }
    this._dirty = false;
    return React.createElement('div', null, elements);
  }

  setRows(rows: RRowType[]) {
    this._rows = rows;
    this.touch();
  }

  touchRow(row: RRowType) {
    let ref = this._rowsMap.get(row.key);
    if (ref && ref.current) {
      ref.current.touch();
    }
  }

  touch() {
    if (this._dirty) {
      return;
    }

    this._dirty = true;
    ReactDOM.unstable_deferredUpdates(() => {
      this.forceUpdate();
    });
  }
}