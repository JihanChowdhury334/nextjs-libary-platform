import { redirect } from "next/navigation";

// /dashboard and /my-books were two pages rendering the same data. This one
// redirects so existing links keep working.
export default function Dashboard() {
  redirect("/my-books");
}
