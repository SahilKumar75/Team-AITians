import { redirect } from "next/navigation";

export default function DoctorPortalPatientsRedirect() {
  redirect("/doctor/patients");
}

