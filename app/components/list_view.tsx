import * as React from "react";
import { FixedSizeList } from "react-window";
import { EditField, Key, ValidationResult } from "../edit_field";
import * as utils from "../utils";

export interface Column<T> {
  name: string;
  getter: (row: T) => any;
  sort?: (a: any, b: any) => number;
  editable?: boolean;
}

export class ListData<T> {
  public rows: T[];
  public checked: boolean[];
  public order: number[];
  constructor(rows: T[], checked?: boolean[], order?: number[]) {
    this.rows = rows;
    this.checked = checked || Array(rows.length).fill(false);
    this.order = order || rows.map((_, idx) => idx);
  }
  public append(row: T): ListData<T> {
    const { rows, checked, order } = this;
    return new ListData(
      rows.concat(row),
      checked.concat(false),
      order.concat(rows.length)
    );
  }
  public removeRows(rowIdxs: number[]): ListData<T> {
    const rowIdxsRev = rowIdxs.slice().sort((a, b) => b - a);
    let newOrder = this.order;
    for (const rowIdx of rowIdxsRev) {
      newOrder = newOrder.reduce((res, idx) => {
        if (idx === rowIdx) {
          return res;
        } else if (idx > rowIdx) {
          res.push(idx - 1);
        } else {
          res.push(idx);
        }
        return res;
      }, Array<number>());
    }
    const f = (_: any, idx: number) => !rowIdxs.some(i => i === idx);
    const newRows = this.rows.filter(f);
    const newChecked = this.checked.filter(f);
    return new ListData(newRows, newChecked, newOrder);
  }
  public sort(
    { getter }: Column<T>,
    sortFn: (a: T, b: T) => number
  ): ListData<T> {
    const { rows, checked, order } = this;
    const newOrder = order.slice();
    newOrder.sort((a, b) => sortFn(getter(rows[a]), getter(rows[b])));
    return new ListData(rows, checked, newOrder);
  }
  public checkAll(check: boolean): ListData<T> {
    return new ListData(
      this.rows,
      Array(this.rows.length).fill(check),
      this.order
    );
  }
  public toggle(idx: number): ListData<T> {
    const newCheckedVals = this.checked.slice();
    newCheckedVals[idx] = !newCheckedVals[idx];
    return new ListData(this.rows, newCheckedVals, this.order);
  }
  get checkedIdxs(): number[] {
    return this.checked.reduce((res, checked, idx) => {
      if (checked) {
        res.push(idx);
      }
      return res;
    }, Array<number>());
  }
  get checkedRows(): T[] {
    return this.checkedIdxs.map(idx => this.rows[idx]);
  }
  public removeSelected(prompt?: string): ListData<T> {
    const idxs = this.checkedIdxs;
    if (prompt && !window.confirm(`Really remove ${idxs.length} ${prompt}?`)) {
      return this;
    }
    return this.removeRows(idxs);
  }
  public replaceRow(oldRowIdx: number, newRow: T): ListData<T> {
    const newRows = this.rows.slice();
    newRows[oldRowIdx] = newRow;
    return new ListData(newRows, this.checked, this.order);
  }
}

type EditedItem<T> = null | { rowIdx: number; colIdx: number };

export interface Props<T> {
  columns: Array<Column<T>>;
  className?: string;
  data: ListData<T> | null;
  checkboxes: boolean;
  filter?: Set<number>;
  onUpdate: (newData: ListData<T>) => void;
  onRowClicked?: (row: T, idx: number) => void;
  onMouseOver?: (row: T, idx: number) => void;
  onItemEdited?: (
    rowIdx: number,
    colIdx: number,
    newVal: string
  ) => ValidationResult;
  getBackgroundColour?: (row: T, idx: number) => string;
}

interface Sort {
  colIdx: number;
  up: boolean;
}

interface RowProps<T> {
  data: ListData<T>;
  columns: Array<Column<T>>;
  checkboxes: boolean;
  editedItem: EditedItem<T>;
  filteredOrdered: number[];
  onRowClicked?: (r: T, idx: number) => void;
  onUpdate?: (newData: ListData<T>) => void;
  onMouseOver?: (row: T, idx: number) => void;
  colStyle: (idx: number) => React.CSSProperties;
  setEditedItem: (item: EditedItem<T>) => void;
  onItemEdited?: (
    item: EditedItem<T>,
    newVal: string,
    key: Key
  ) => ValidationResult;
  getBackgroundColour?: (row: T, idx: number) => string;
}

function Row(props) {
  const {
    data,
    columns,
    checkboxes,
    onRowClicked,
    onUpdate,
    onMouseOver,
    colStyle,
    editedItem,
    filteredOrdered,
    setEditedItem,
    onItemEdited,
    getBackgroundColour
  } = props.data as RowProps<any>;
  const index = filteredOrdered[props.index];
  const r = data.rows[index];
  return (
    <div
      style={
        getBackgroundColour
          ? { ...props.style, backgroundColor: getBackgroundColour(r, index) }
          : { ...props.style }
      }
      className={onRowClicked ? "lv_row clickable" : "lv_row"}
      onClick={() => {
        if (onRowClicked) {
          onRowClicked(r, index);
        }
      }}
      onMouseOver={() => {
        if (onMouseOver) {
          onMouseOver(r, index);
        }
      }}
    >
      {onUpdate && checkboxes && (
        <div className="lv_cell lv_checkboxcell">
          <input
            type="checkbox"
            checked={data.checked[index]}
            onChange={() => {
              onUpdate(data.toggle(index));
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      {columns.map((c, colIdx) => {
        const editing =
          editedItem &&
          editedItem.rowIdx === index &&
          editedItem.colIdx === colIdx;
        return (
          <div
            style={colStyle(colIdx)}
            className={editing ? "lv_cell editing" : "lv_cell"}
            key={colIdx}
            onClick={
              c.editable
                ? () => setEditedItem({ rowIdx: index, colIdx })
                : undefined
            }
          >
            {!editing && c.getter(r)}
            {editing && (
              <EditField
                initialStateEditing={true}
                initialValue={c.getter(r)}
                onCancel={() => setEditedItem(null)}
                onSave={(val, key) =>
                  onItemEdited({ rowIdx: index, colIdx }, val, key)
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface HeaderProps<T> {
  data: ListData<T>;
  sorted: Sort | null;
  columns: Array<Column<T>>;
  allChecked?: boolean;
  onCheckAll?: () => void;
  onSort?: (idx: number) => void;
  colStyle: (idx: number) => React.CSSProperties;
  style?: React.CSSProperties;
}

function Header<T>(props: HeaderProps<T>) {
  const {
    data,
    sorted,
    columns,
    allChecked,
    onCheckAll,
    onSort,
    colStyle,
    style
  } = props;
  if (!data) {
    return null;
  }
  const headerCol = (col: Column<T>, idx: number) => (
    <div
      className="lv_cell"
      style={colStyle(idx)}
      key={idx}
      onClick={() => {
        if (onSort) {
          onSort(idx);
        }
      }}
    >
      {sorted && sorted.colIdx === idx && (sorted.up ? "▴" : "▾")}
      {col.name}
    </div>
  );
  if (onCheckAll) {
    return (
      <div style={style} className="lv_row lv_header">
        <div className="lv_cell lv_checkboxcell" style={{ flex: "0 1 25px" }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => onCheckAll()}
          />
        </div>
        {columns.map(headerCol)}
      </div>
    );
  } else {
    return (
      <div style={style} className="lv_row lv_header">
        {columns.map(headerCol)}
      </div>
    );
  }
}

// needed to trick typescript into accepting the generic parameter
export const ListView = React.memo(ListViewImpl) as typeof ListViewImpl;

function ListViewImpl<T>(props: Props<T>) {
  const [sorted, setSorted] = React.useState<Sort | null>(null);
  const { data } = props;
  const mainDiv = React.useRef<HTMLDivElement>(null);
  const [width, height] = utils.useElementSize(mainDiv);
  const [editedItem, setEditedItem] = React.useState<EditedItem<T>>(null);

  function sort(colIdx: number) {
    if (!data) {
      return;
    }
    const col = props.columns[colIdx];
    const sorter = col.sort;
    if (sorter) {
      const up = !!sorted && sorted.colIdx === colIdx && !sorted.up;
      setSorted({
        colIdx,
        up
      });
      const sortFn = up
        ? (a: any, b: any) => sorter(a, b)
        : (b: any, a: any) => sorter(a, b);
      props.onUpdate(data.sort(col, sortFn));
    }
  }

  const available = props.checkboxes ? width - 25 : width;
  const rows = data ? data.rows : [];
  const filteredOrdered = data
    ? props.filter
      ? data.order.filter(idx => props.filter.has(idx))
      : data.order
    : [];
  const maxWidths = React.useMemo(() => {
    const [charWidth, _] = utils.getMonoCharDimensions();
    return props.columns.map(c =>
      Math.max(
        0, // avoid -Infinity if list is empty
        ...filteredOrdered.map(idx => {
          const v = c.getter(rows[idx]);
          return v ? v.toString().length * charWidth : 0;
        })
      )
    );
  }, [rows, props.columns, props.filter]);

  const colFlexBases = maxWidths.map(w =>
    Math.min(w, available / props.columns.length)
  );

  const colStyle = idx => ({
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: colFlexBases[idx]
  });

  const allChecked = data && filteredOrdered.every(idx => data.checked[idx]);

  const onItemEdited = (
    { rowIdx, colIdx }: EditedItem<T>,
    newVal: string,
    key: Key
  ) => {
    if (props.onItemEdited) {
      const error = props.onItemEdited(rowIdx, colIdx, newVal);
      if (error) {
        return error;
      }
      switch (key) {
        case "Tab":
          if (colIdx < props.columns.length - 1) {
            setEditedItem({ rowIdx, colIdx: colIdx + 1 });
          } else {
            setEditedItem(null);
          }
          break;
        case "Enter":
          const orderIdx = filteredOrdered.findIndex(i => i === rowIdx);
          if (orderIdx < filteredOrdered.length - 1) {
            setEditedItem({ rowIdx: filteredOrdered[orderIdx + 1], colIdx });
          } else {
            setEditedItem(null);
          }
          break;
        case "Click":
          setEditedItem(null);
          break;
      }
    }
  };

  const rowProps: RowProps<T> = {
    // TODO: just pass props?
    checkboxes: props.checkboxes,
    colStyle,
    columns: props.columns,
    data: props.data,
    filteredOrdered,
    onMouseOver: props.onMouseOver,
    onRowClicked: props.onRowClicked,
    onUpdate: props.onUpdate,
    editedItem,
    setEditedItem,
    onItemEdited,
    getBackgroundColour: props.getBackgroundColour
  };

  // hide until we get the dimensions
  const style = width && height ? {} : { display: "none" };

  return (
    <div className={"lv_main " + (props.className || "")} ref={mainDiv}>
      {data && (
        <Header
          style={style}
          data={data}
          columns={props.columns}
          onCheckAll={
            props.checkboxes
              ? () => props.onUpdate(data.checkAll(!allChecked))
              : undefined
          }
          allChecked={allChecked}
          sorted={sorted}
          onSort={idx => sort(idx)}
          colStyle={colStyle}
        />
      )}
      {data && (
        <FixedSizeList
          style={style}
          itemData={rowProps}
          itemCount={filteredOrdered.length}
          itemSize={25}
          width={width}
          height={height - 25}
          itemKey={(idx, itemData) => itemData.filteredOrdered[idx]}
        >
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}
