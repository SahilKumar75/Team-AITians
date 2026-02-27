import { redirect } from "next/navigation";

export default function DoctorPortalRootRedirect() {
  redirect("/doctor/home");
}

