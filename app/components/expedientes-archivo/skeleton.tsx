"use client";

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="expList" aria-busy="true" aria-label="Cargando expedientes">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="expListItem">
          <div className="expListItemIcon">
            <div className="expSkeleton" style={{ width: 18, height: 18, borderRadius: 4 }} />
          </div>
          <div className="expListItemBody">
            <div className="expSkeleton" style={{ width: "70%", height: 14, marginBottom: 8 }} />
            <div className="expSkeleton" style={{ width: "50%", height: 11, marginBottom: 6 }} />
            <div className="expSkeleton" style={{ width: "40%", height: 11 }} />
          </div>
          <div className="expListItemActions">
            <div className="expSkeleton" style={{ width: 24, height: 24, borderRadius: 6 }} />
            <div className="expSkeleton" style={{ width: 24, height: 24, borderRadius: 6 }} />
            <div className="expSkeleton" style={{ width: 24, height: 24, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="expStats" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="expStatCard">
          <div className="expStatHeader">
            <div className="expSkeleton" style={{ width: 50, height: 10 }} />
            <div className="expSkeleton" style={{ width: 16, height: 16, borderRadius: 4 }} />
          </div>
          <div className="expSkeleton" style={{ width: 60, height: 26, marginTop: 8 }} />
          <div className="expSkeleton" style={{ width: 80, height: 10, marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="expCardsGrid" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="expCard" style={{ cursor: "default" }}>
          <div className="expCardHeader">
            <div className="expSkeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div className="expSkeleton" style={{ width: 60, height: 16, borderRadius: 999 }} />
          </div>
          <div className="expSkeleton" style={{ width: "85%", height: 14, marginTop: 8 }} />
          <div className="expSkeleton" style={{ width: "60%", height: 11, marginTop: 8 }} />
          <div className="expSkeleton" style={{ width: "70%", height: 11, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="expTableWrap" aria-busy="true">
      <table className="expTable">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th style={{ width: 140 }}></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><div className="expSkeleton" style={{ width: 16, height: 16, borderRadius: 3 }} /></td>
              <td>
                <div className="expSkeleton" style={{ width: "80%", height: 13, marginBottom: 6 }} />
                <div className="expSkeleton" style={{ width: "50%", height: 10 }} />
              </td>
              <td><div className="expSkeleton" style={{ width: 40, height: 12 }} /></td>
              <td><div className="expSkeleton" style={{ width: 80, height: 12 }} /></td>
              <td><div className="expSkeleton" style={{ width: 50, height: 12 }} /></td>
              <td><div className="expSkeleton" style={{ width: 70, height: 18, borderRadius: 999 }} /></td>
              <td>
                <div style={{ display: "flex", gap: 4 }}>
                  <div className="expSkeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <div className="expSkeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <div className="expSkeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
