// @flow

import React, { type Element } from 'react';
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
    const elements: Element<*>[] = new Array(len);
    const rowsMap = new Map();

    for (let i = 0; i < len; i++) {
      const row = rows[i];
      const key = row.key;
      const ref = React.createRef();
      elements[i] = React.createElement(RRow, { key, ref, row });
      rowsMap.set(key, ref);
    }

    this._rowsMap = rowsMap;
    this._dirty = false;
    return elements;
  }

  setRows(rows: RRowType[]) {
    this._rows = rows;
    this.touch();
  }

  touchRow(row: RRowType) {
    if (this._dirty) {
      return;
    }

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
    this.forceUpdate();
  }
}
