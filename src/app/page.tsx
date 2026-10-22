import { Tracker } from "@/components/tracker";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Tracker demo={process.env.DEMO_MODE === "true"} />;
}
