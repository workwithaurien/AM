/**
 * salary.js — figures are computed client-side from attendance, never
 * stored pre-calculated (per the brief). History rows come from the sheet as-is.
 */
const PageSalary = (() => {
  async function render(mount) {
    const res = await Api.call("getSalary");
    if (!res.ok) { mount.innerHTML = `<div class="empty-state">${res.error}</div>`; return; }
    const s = res.salary;

    const perDay = s.monthlySalary / s.totalWorkingDays;
    const earnedTillDate = Math.round(perDay * s.presentDays);
    const netPayable = earnedTillDate - s.advanceTaken;

    mount.innerHTML = `
      <div class="grid grid-4">
        ${Card.stat({
          label: "Present Days",
          value: `${s.presentDays}/${s.totalWorkingDays}`,
          sub: presentDaysSub(s)
        })}
        ${Card.stat({ label: "Earned (Real-Time)", value: Utils.currency(earnedTillDate), sub: "Recalculated from attendance" })}
        ${Card.stat({ label: "Advance Salary", value: Utils.currency(s.advanceTaken) })}
        ${Card.stat({ label: "Net Payable", value: Utils.currency(netPayable), sub: "Earned − advance taken" })}
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-title">Salary Calculator</div>
        <div class="card-sub" style="margin-bottom:12px">Enter any number of present days to estimate the salary for that many days.</div>
        <div class="grid grid-3" style="align-items:start">
          <div class="field" style="margin-bottom:0">
            <label>Present Days</label>
            <input class="input" type="number" min="0" id="calcPresentDays" value="${s.presentDays}" />
          </div>
          <div>
            <div class="card-label">Estimated Salary</div>
            <div class="card-value" id="calcEarned">${Utils.currency(earnedTillDate)}</div>
          </div>
          <div>
            <div class="card-label">Net Payable</div>
            <div class="card-value" id="calcNetPayable">${Utils.currency(netPayable)}</div>
          </div>
        </div>
      </div>

      <div class="section-head"><h2>Salary History</h2></div>
      ${DataTable.render(
        [
          { key: "month", label: "Month" },
          { key: "presentDays", label: "Present Days" },
          { key: "earned", label: "Earned" },
          { key: "advance", label: "Advance" },
          { key: "netPaid", label: "Net Paid" },
          { key: "status", label: "Status" }
        ],
        s.history.map(h => ({
          month: h.month,
          presentDays: h.presentDays,
          earned: Utils.currency(h.earned),
          advance: Utils.currency(h.advance),
          netPaid: Utils.currency(h.netPaid),
          status: Badge.render(h.status, h.status === "Paid" ? "success" : "warning")
        }))
      )}
    `;

    document.getElementById("calcPresentDays").addEventListener("input", e => {
      const days = Number(e.target.value) || 0;
      const estimated = Math.round(perDay * days);
      document.getElementById("calcEarned").textContent = Utils.currency(estimated);
      document.getElementById("calcNetPayable").textContent = Utils.currency(estimated - s.advanceTaken);
    });
  }

  function presentDaysSub(s) {
    const parts = [];
    if (s.paidLeaveUsed > 0) parts.push(`${s.paidLeaveUsed} paid leave day${s.paidLeaveUsed === 1 ? "" : "s"} used`);
    if (s.paidLeaveCashoutDays > 0) parts.push(`${s.paidLeaveCashoutDays}d unused leave cashed out`);
    return parts.join(" · ");
  }

  return { render };
})();
