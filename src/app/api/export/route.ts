import { exportCSV } from "@/lib/csv";
import { listApplications } from "@/lib/applications";
import { apiError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return new Response(
      exportCSV(JSON.parse(JSON.stringify(await listApplications()))),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="internshiphq-backup.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
