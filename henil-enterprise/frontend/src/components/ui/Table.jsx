import './Table.css';

/*
  columns: [{ key, header, width?, align?: 'left'|'right'|'center', render?: (row) => node }]
  rows: array of data objects (each should have a unique `id`)
*/
function Table({ columns = [], rows = [], onRowClick, stickyHeader = false }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead className={stickyHeader ? 'table__head--sticky' : ''}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align || 'left' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={onRowClick ? 'table__row--clickable' : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
