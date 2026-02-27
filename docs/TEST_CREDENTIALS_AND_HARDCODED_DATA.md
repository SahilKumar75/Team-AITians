# Test credentials (Pune hospitals & doctors) and hardcoded data

**No patient test credentials or patient-related hardcoded data.** Patient portal data comes from the user’s own profile (API/localStorage) — nothing patient-specific is hardcoded in hospital/doctor APIs or frontend.

---

## 1. Pune-based hospitals (3) — credentials

Use these in the app: **Sign up** → choose **Hospital** → enter email/password → then **Log in** with the same.

| Hospital | Email | Password |
|----------|--------|----------|
| Sahyadri Super Speciality Hospital | `sahyadri.hospital@test.com` | `TestSahyadri1!` |
| Jehangir Hospital | `jehangir.hospital@test.com` | `TestJehangir1!` |
| Ruby Hall Clinic | `rubyhall.hospital@test.com` | `TestRubyHall1!` |

---

## 2. Doctors per hospital (7 each) — credentials

Use these in the app: **Sign up** → choose **Doctor** → enter email/password → then **Log in**. Assign doctors to the correct hospital in the app (e.g. doctor profile → hospital).

### Sahyadri Super Speciality Hospital (7 doctors)

| # | Name | Email | Password |
|---|------|--------|----------|
| 1 | Dr. Rajesh Kulkarni | `sahyadri.doctor1@test.com` | `TestDoctor1!` |
| 2 | Dr. Priya Deshmukh | `sahyadri.doctor2@test.com` | `TestDoctor2!` |
| 3 | Dr. Amit Joshi | `sahyadri.doctor3@test.com` | `TestDoctor3!` |
| 4 | Dr. Sunita Patil | `sahyadri.doctor4@test.com` | `TestDoctor4!` |
| 5 | Dr. Vikram Rao | `sahyadri.doctor5@test.com` | `TestDoctor5!` |
| 6 | Dr. Anjali Mehta | `sahyadri.doctor6@test.com` | `TestDoctor6!` |
| 7 | Dr. Sanjay Nair | `sahyadri.doctor7@test.com` | `TestDoctor7!` |

### Jehangir Hospital (7 doctors)

| # | Name | Email | Password |
|---|------|--------|----------|
| 1 | Dr. Meera Iyer | `jehangir.doctor1@test.com` | `TestDoctor8!` |
| 2 | Dr. Karan Sharma | `jehangir.doctor2@test.com` | `TestDoctor9!` |
| 3 | Dr. Neha Gupta | `jehangir.doctor3@test.com` | `TestDoctor10!` |
| 4 | Dr. Ravi Menon | `jehangir.doctor4@test.com` | `TestDoctor11!` |
| 5 | Dr. Pooja Reddy | `jehangir.doctor5@test.com` | `TestDoctor12!` |
| 6 | Dr. Arjun Kapoor | `jehangir.doctor6@test.com` | `TestDoctor13!` |
| 7 | Dr. Kavita Nair | `jehangir.doctor7@test.com` | `TestDoctor14!` |

### Ruby Hall Clinic (7 doctors)

| # | Name | Email | Password |
|---|------|--------|----------|
| 1 | Dr. Suresh Pandey | `rubyhall.doctor1@test.com` | `TestDoctor15!` |
| 2 | Dr. Lakshmi Venkatesh | `rubyhall.doctor2@test.com` | `TestDoctor16!` |
| 3 | Dr. Deepak Malhotra | `rubyhall.doctor3@test.com` | `TestDoctor17!` |
| 4 | Dr. Rekha Krishnan | `rubyhall.doctor4@test.com` | `TestDoctor18!` |
| 5 | Dr. Manoj Bhat | `rubyhall.doctor5@test.com` | `TestDoctor19!` |
| 6 | Dr. Shalini Rao | `rubyhall.doctor6@test.com` | `TestDoctor20!` |
| 7 | Dr. Nitin Desai | `rubyhall.doctor7@test.com` | `TestDoctor21!` |

---

## 3. Where the hospital/doctor data comes from (no patient hardcoding)

- **Hospital list, departments, queue numbers, doctors (display):**  
  `src/app/api/hospitals/route.ts` — static JSON (3 Pune hospitals, 7 doctors each, departments with `avgServiceTime`, `currentQueue`, etc.). **No patient data** in this file. **Queue is 0** until real journey data exists (`currentQueue: 0` for all departments).

- **Journeys per hospital:**  
  `src/app/api/hospitals/[id]/journeys/route.ts` — returns `journeys: []` (stub). No patient data.

- **Single journey detail:**  
  `src/app/api/journey/[id]/route.ts` — stub journey object. No patient-specific hardcoding.

- **Patient profile:**  
  `src/app/api/patient/status/route.ts` — returns **null/empty** fields unless a wallet is passed; no hardcoded patient names, DOB, or medical info. Anything you see on the **patient** portal (e.g. “My Portal”) is from the logged-in user’s own data (localStorage/API), not from hardcoded patient records.

So: **nothing on the frontend that is patient-role-specific is hardcoded.** Hospital and doctor list/display data is the only hardcoded data, in the hospitals API.

---

## 4. UI labels: “Avg Service: X min” and “Est Wait: Y min”

These are **not** extra undocumented buttons; they come from **department data** returned by the hospitals API:

- **Avg Service (e.g. 5 min):**  
  From each department’s **`avgServiceTime`** (minutes). The UI shows it as “Avg Service: X min”.

- **Est Wait (e.g. 0 min when queue is 0):**  
  Derived from **queue × service time** (e.g. `currentQueue * avgServiceTime`). When there is no real patient/journey data, queue is 0, so Est Wait shows 0 min.

So they are driven by the same hospital/department data in the API; no separate patient data is used.

---

## 5. Portal vs Home

- **Home** = the main dashboard you get from the **nav “Home”** link (e.g. `/patient/home`, `/hospital-portal/home`, `/doctor-portal/home`). It’s the default landing after login for that role.

- **Portal** = the full profile / “My Portal” (or “Hospital Portal” / “Doctor Portal”) page opened from the **profile dropdown** (e.g. “Patient Portal” → `/patient/patient-portal/home` or `/patient`, “Hospital Portal” → `/hospital-portal/home`, “Doctor Portal” → `/doctor-portal`). It’s the detailed view for that role.

So: **Home** and **Portal** are different screens; portal is the one opened from the dropdown.

---

## 6. Dev bypass (no login)

To test the app without logging in:

- `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`
- **Optional:** `NEXT_PUBLIC_DEV_ROLE=doctor` | `hospital` | `patient`. **Default is `doctor`** if unset.

With bypass enabled you are redirected to the role’s home (doctor → `/doctor/doctor-portal/home`, hospital → `/hospital/home`, patient → `/patient/patient-portal/home`). The navbar and profile show a **mock identity** for that role:

- **Doctor (default):** Dr. Rajesh Kulkarni, `sahyadri.doctor1@test.com` (mock doctor from Sahyadri).
- **Hospital:** Sahyadri Hospital, `sahyadri.hospital@test.com`.
- **Patient:** no mock identity; uses generic “User” / email from env if any.

To test **doctor** role: set only `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` (or explicitly `NEXT_PUBLIC_DEV_ROLE=doctor`), then open the app — you’ll be redirected to the doctor portal.

---

## 7. Hospital sees only their hospital (no “Select Hospital”)

When you are logged in as **hospital** (or using dev bypass with `NEXT_PUBLIC_DEV_ROLE=hospital`), the hospital portal and admin show **only one hospital** — there is no “Select Hospital” dropdown. Which hospital is shown:

- **Optional:** Set in the browser: `localStorage.setItem("hospital_linked_id", "h1")` (or `"h2"`, `"h3"`) so that hospital is used. IDs: `h1` = Sahyadri, `h2` = Jehangir, `h3` = Ruby Hall.
- **Default:** If `hospital_linked_id` is not set, the first hospital from the API (Sahyadri) is shown.

So a hospital user only controls their own hospital, not others.
