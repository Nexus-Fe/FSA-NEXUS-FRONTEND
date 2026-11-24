import "./Skeleton.css";

export function TableSkeleton({
  rows = 5,
  cols = 4,
  label = "Đang tải dữ liệu…",
}: {
  rows?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <div className="card" role="status" aria-label={label}>
      <div className="table-scroll">
        <table className="data-table" aria-hidden="true">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <th key={colIdx} className="skeleton-table-cell">
                  <div className="skeleton-shimmer skeleton-line skeleton-line-short" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {Array.from({ length: cols }).map((_, colIdx) => (
                  <td key={colIdx} className="skeleton-table-cell">
                    <div
                      className={`skeleton-shimmer skeleton-line ${
                        colIdx % 2 === 0 ? "skeleton-line-medium" : "skeleton-line-short"
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 8,
  label = "Đang tải danh sách…",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="skeleton-card-grid" role="status" aria-label={label}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-card" aria-hidden="true">
          <div className="skeleton-shimmer skeleton-card-media" />
          <div className="skeleton-card-body">
            <div className="skeleton-shimmer skeleton-line" />
            <div className="skeleton-shimmer skeleton-line skeleton-line-medium" />
            <div className="skeleton-shimmer skeleton-line skeleton-line-short" />
          </div>
        </div>
      ))}
    </div>
  );
}
