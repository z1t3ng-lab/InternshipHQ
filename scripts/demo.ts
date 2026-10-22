import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
// Always use the separate demo database, regardless of the user's .env settings.
process.env.DATABASE_URL = `file:${resolve("prisma/demo.db")}`;
execFileSync(process.execPath, ["--import", "tsx", "scripts/prepare-db.ts"], {
  stdio: "inherit",
  env: process.env,
});
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
const { db } = await import("../src/lib/db");
const { todayInToronto, addDays } = await import("../src/lib/domain");
const today = todayInToronto();
const data = [
  {
    company: "Fictional Maple Labs",
    position: "Software Engineering Intern",
    status: "Interview",
    priority: "High",
    nextAction: "Prepare for the technical interview",
    nextActionDue: today,
    dateApplied: addDays(today, -18),
    term: "Summer 2027",
    location: "Toronto, ON",
    arrangement: "Hybrid",
  },
  {
    company: "Fictional Orbit Studio",
    position: "Product Design Intern",
    status: "Preparing",
    priority: "High",
    nextAction: "Finish the portfolio case study",
    nextActionDue: addDays(today, -2),
    deadline: addDays(today, 3),
    term: "Summer 2027",
    arrangement: "Remote",
  },
  {
    company: "Fictional Fern Systems",
    position: "Frontend Developer Intern",
    status: "Applied",
    priority: "Medium",
    dateApplied: addDays(today, -10),
    nextAction: "Research the engineering team",
    nextActionDue: addDays(today, 2),
    term: "Summer 2027",
    location: "Vancouver, BC",
  },
  {
    company: "Fictional Lunar Works",
    position: "Data Science Intern",
    status: "Assessment",
    priority: "High",
    dateApplied: addDays(today, -7),
    nextAction: "Complete the coding assessment",
    nextActionDue: addDays(today, 4),
    location: "Montréal, QC",
    arrangement: "Hybrid",
  },
  {
    company: "Fictional Pebble Tech",
    position: "Backend Engineering Intern",
    status: "Saved",
    deadline: addDays(today, 6),
    term: "Fall 2027",
    arrangement: "On-site",
  },
  {
    company: "Fictional Paper Kite",
    position: "UX Research Intern",
    status: "Saved",
  },
  {
    company: "Fictional Cedar Robotics",
    position: "Engineering Intern",
    status: "Offer",
    dateApplied: addDays(today, -30),
    term: "Summer 2027",
  },
  {
    company: "Fictional Tide Analytics",
    position: "Business Analyst Intern",
    status: "Rejected",
    dateApplied: addDays(today, -25),
  },
  {
    company: "Fictional Ember Cloud",
    position: "Platform Engineering Intern",
    status: "Withdrawn",
    dateApplied: addDays(today, -20),
  },
  {
    company: "Fictional Moss Digital",
    position: "Marketing Intern",
    status: "Applied",
    dateApplied: addDays(today, -8),
    term: "Summer 2027",
  },
  {
    company: "Fictional Finch Games",
    position: "Gameplay Engineering Intern",
    status: "Preparing",
    priority: "Medium",
    term: "Fall 2027",
  },
  {
    company: "Fictional Northstar Tools",
    position: "Full Stack Engineering Intern",
    status: "Interview",
    dateApplied: addDays(today, -15),
    nextAction: "Review my project walkthrough",
    nextActionDue: addDays(today, 5),
    term: "Summer 2027",
  },
];
const { applicationSchema } = await import("../src/lib/domain");
for (const [i, row] of data.entries()) {
  const id = `demo-${i + 1}`;
  await db.application.upsert({
    where: { id },
    update: {},
    create: {
      id,
      ...applicationSchema.parse(row),
      notes:
        "Fictional demo application. This company and opportunity are invented for demonstration.",
      activities: {
        create: {
          type: "created",
          message: `Fictional demo application created · ${row.status}`,
        },
      },
    },
  });
}
await db.$disconnect();
console.log(
  "Demo ready in prisma/demo.db. Run npm run dev:demo and open http://localhost:3001.",
);
