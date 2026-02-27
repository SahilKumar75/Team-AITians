import { redirect } from "next/navigation";

export default function HospitalPortalRootRedirect() {
  redirect("/hospital/home");
}

