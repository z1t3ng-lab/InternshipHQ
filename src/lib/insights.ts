import {
  type ApplicationRecord,
  type Status,
  STATUSES,
  todayInToronto,
} from "./domain";
const responseStatuses = new Set([
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
]);
export function recordedEvents(a: ApplicationRecord) {
  const events = (a.statusEvents || []).map((e) => ({ ...e, observed: false }));
  // Audit entries establish when a transition was recorded. Initial/imported
  // statuses establish stage membership only, never a historical response date.
  for (const activity of a.activities) {
    if (activity.type === "status" || activity.type === "email") {
      const match =
        /Status changed from (Saved|Preparing|Applied|Assessment|Interview|Offer|Rejected|Withdrawn) to (Saved|Preparing|Applied|Assessment|Interview|Offer|Rejected|Withdrawn)(?:$| ·)/.exec(
          activity.message,
        );
      if (match) {
        events.push({
          status: match[1],
          occurredAt: activity.createdAt,
          observed: false,
        });
        events.push({
          status: match[2],
          occurredAt: activity.createdAt,
          observed: true,
        });
      }
    }
    if (activity.type === "created") {
      const match = /^Application created · (.+)$/.exec(activity.message);
      if (match && STATUSES.includes(match[1] as Status))
        events.push({
          status: match[1],
          occurredAt: activity.createdAt,
          observed: false,
        });
    }
  }
  return events
    .filter((e) => Number.isFinite(Date.parse(e.occurredAt)))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

const days = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
const summary = (values: number[]) => {
  const sorted = values.sort((a, b) => a - b);
  const n = sorted.length;
  return {
    count: n,
    median: n
      ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2
      : null,
  };
};
export function applicationInsights(
  records: ApplicationRecord[],
  today: string,
  start = "",
  end = "",
) {
  const cohort = records.filter(
    (a) =>
      (!start && !end) ||
      (!!a.dateApplied &&
        (!start || a.dateApplied >= start) &&
        (!end || a.dateApplied <= end)),
  );
  const rows = cohort.map((a) => {
    const events = recordedEvents(a),
      reached = new Set([a.status, ...events.map((e) => e.status)]);
    const submitted =
      !!a.dateApplied ||
      [...reached].some((s) =>
        ["Applied", "Assessment", "Interview", "Offer"].includes(s),
      );
    const interview = reached.has("Interview");
    const offer = reached.has("Offer");
    const response = [...reached].some((s) => responseStatuses.has(s));
    // Timing requires a dated submission and an observed later status transition.
    // Creating/importing a record directly in Interview does not invent a response date.
    const observed = events.filter((e) => e.observed);
    const elapsed = (statuses: Set<string>) => {
      if (!a.dateApplied) return null;
      const event = observed.find(
        (e) =>
          statuses.has(e.status) &&
          todayInToronto(new Date(e.occurredAt)) >= a.dateApplied,
      );
      return event
        ? days(a.dateApplied, todayInToronto(new Date(event.occurredAt)))
        : null;
    };
    return {
      a,
      submitted,
      interview,
      offer,
      response,
      responseDays: elapsed(responseStatuses),
      interviewDays: elapsed(new Set(["Interview"])),
      offerDays: elapsed(new Set(["Offer"])),
    };
  });
  const submitted = rows.filter((r) => r.submitted).length;
  const steps = [
    { label: "Submitted", count: submitted },
    {
      label: "Received a response",
      count: rows.filter((r) => r.submitted && r.response).length,
    },
    {
      label: "Reached interview",
      count: rows.filter((r) => r.submitted && r.interview).length,
    },
    {
      label: "Received an offer",
      count: rows.filter((r) => r.submitted && r.offer).length,
    },
  ];
  const waiting = rows
    .filter(
      (r) =>
        r.a.dateApplied &&
        r.a.dateApplied <= today &&
        !r.response &&
        !["Withdrawn", "Saved", "Preparing"].includes(r.a.status),
    )
    .map((r) => ({ application: r.a, days: days(r.a.dateApplied, today) }))
    .sort((a, b) => b.days - a.days);
  return {
    total: cohort.length,
    submitted,
    steps,
    timings: [
      {
        label: "To first response",
        ...summary(
          rows.flatMap((r) =>
            r.responseDays === null ? [] : [r.responseDays],
          ),
        ),
      },
      {
        label: "To interview stage",
        ...summary(
          rows.flatMap((r) =>
            r.interviewDays === null ? [] : [r.interviewDays],
          ),
        ),
      },
      {
        label: "To offer",
        ...summary(
          rows.flatMap((r) => (r.offerDays === null ? [] : [r.offerDays])),
        ),
      },
    ],
    waiting,
    statuses: STATUSES.map((status) => ({
      status,
      count: cohort.filter((a) => a.status === status).length,
    })),
  };
}
