import { redirect } from "next/navigation";

/** Legacy /outline → /timeline */
export default function OutlineRedirect() {
  redirect("/timeline");
}
