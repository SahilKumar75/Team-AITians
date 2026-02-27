/**
 * Optional decentralized index layer (Phase 3).
 * When SUBGRAPH_URL/NEXT_PUBLIC_SUBGRAPH_URL is configured, search/list queries can use it.
 * Source of truth remains blockchain + IPFS; index is query acceleration only.
 */

const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "";

export interface IndexedDoctor {
  id: string;
  walletAddress: string;
  name: string;
  specialization?: string;
  hospital?: string;
  hospitalId?: string;
  email?: string;
  phone?: string;
  lockACid?: string;
}

export interface IndexedHospital {
  id: string;
  name: string;
  code?: string;
  city?: string;
  state?: string;
  type?: string;
}

export interface IndexedPatientIdentity {
  id: string;
  wallet: string;
  role: string;
  lockACid: string;
  title?: string;
  updatedAtBlock?: number;
}

async function runSubgraphQuery<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!SUBGRAPH_URL) return null;
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T; errors?: unknown[] };
    if (!json.data || (Array.isArray(json.errors) && json.errors.length > 0)) return null;
    return json.data;
  } catch {
    return null;
  }
}

export async function getSubgraphMetaBlock(): Promise<number | null> {
  if (!SUBGRAPH_URL) return null;
  const gql = `
    query MetaBlock {
      _meta {
        block {
          number
        }
      }
    }
  `;
  const data = await runSubgraphQuery<{ _meta?: { block?: { number?: number } } }>(gql, {});
  const n = Number(data?._meta?.block?.number);
  return Number.isFinite(n) ? n : null;
}

export async function searchDoctorsFromSubgraph(query: string): Promise<IndexedDoctor[]> {
  const q = query.trim().toLowerCase();
  if (!q || !SUBGRAPH_URL) return [];

  const gql = `
    query SearchDoctors($q: String!) {
      doctors(
        where: {
          or: [
            { name_contains_nocase: $q }
            { specialization_contains_nocase: $q }
            { email_contains_nocase: $q }
            { wallet_contains_nocase: $q }
          ]
        }
        first: 20
      ) {
        id
        wallet
        name
        specialization
        hospitalName
        hospitalId
        email
      }
    }
  `;

  const data = await runSubgraphQuery<{
    doctors?: Array<{
      id: string;
      wallet: string;
      name?: string;
      specialization?: string;
      hospitalName?: string;
      hospitalId?: string;
      email?: string;
    }>;
  }>(gql, { q });

  const rows = data?.doctors ?? [];
  return rows
    .filter((d) => typeof d.wallet === "string" && d.wallet.length > 0)
    .map((d) => ({
      id: d.id || `doctor-${d.wallet.toLowerCase()}`,
      walletAddress: d.wallet,
      name: d.name || "Doctor",
      specialization: d.specialization || "Verified clinician",
      hospital: d.hospitalName || "On-chain identity",
      hospitalId: d.hospitalId || "",
      email: d.email || "",
    }));
}

export async function listDoctorsByWalletsFromSubgraph(wallets: string[]): Promise<IndexedDoctor[]> {
  const uniqueWallets = Array.from(
    new Set(
      wallets
        .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
        .filter((w) => w.startsWith("0x") && w.length === 42)
    )
  );
  if (!SUBGRAPH_URL || uniqueWallets.length === 0) return [];

  const gql = `
    query DoctorsByWallets($wallets: [String!]) {
      doctors(where: { wallet_in: $wallets }, first: 200) {
        id
        wallet
        name
        email
        specialization
        hospitalName
        hospitalId
      }
    }
  `;

  const data = await runSubgraphQuery<{
    doctors?: Array<{
      id: string;
      wallet: string;
      name?: string;
      email?: string;
      specialization?: string;
      hospitalName?: string;
      hospitalId?: string;
    }>;
  }>(gql, { wallets: uniqueWallets });

  const rows = data?.doctors ?? [];
  return rows
    .filter((d) => typeof d.wallet === "string" && d.wallet.length === 42)
    .map((d) => ({
      id: d.id || `doctor-${d.wallet.toLowerCase()}`,
      walletAddress: d.wallet.toLowerCase(),
      name: d.name || "Doctor",
      email: d.email || "",
      specialization: d.specialization || "Verified clinician",
      hospital: d.hospitalName || "On-chain identity",
      hospitalId: d.hospitalId || "",
    }));
}

export async function listPatientIdentitiesFromSubgraph(opts?: {
  limit?: number;
  pageSize?: number;
}): Promise<IndexedPatientIdentity[]> {
  if (!SUBGRAPH_URL) return [];
  const limit = Math.max(1, Math.min(20000, opts?.limit ?? 5000));
  const pageSize = Math.max(50, Math.min(1000, opts?.pageSize ?? 500));
  const out: IndexedPatientIdentity[] = [];

  const gql = `
    query Patients($first: Int!, $skip: Int!) {
      identities(
        where: { role: "patient" }
        first: $first
        skip: $skip
        orderBy: updatedAtBlock
        orderDirection: desc
      ) {
        id
        wallet
        role
        lockACid
        title
        updatedAtBlock
      }
    }
  `;

  let skip = 0;
  while (out.length < limit) {
    const data = await runSubgraphQuery<{
      identities?: Array<{
        id: string;
        wallet: string;
        role: string;
        lockACid: string;
        title?: string;
        updatedAtBlock?: string;
      }>;
    }>(gql, { first: pageSize, skip });
    const rows = data?.identities ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const wallet = (row.wallet || "").toLowerCase();
      if (!wallet || !row.lockACid) continue;
      out.push({
        id: row.id,
        wallet,
        role: row.role || "patient",
        lockACid: row.lockACid,
        title: row.title || undefined,
        updatedAtBlock: Number(row.updatedAtBlock || 0) || undefined,
      });
      if (out.length >= limit) break;
    }

    if (rows.length < pageSize) break;
    skip += pageSize;
  }

  return out;
}

export async function searchPatientIdentitiesByTitleFromSubgraph(
  query: string,
  opts?: { limit?: number; pageSize?: number }
): Promise<IndexedPatientIdentity[]> {
  const q = query.trim();
  if (!SUBGRAPH_URL || !q) return [];
  const limit = Math.max(1, Math.min(2000, opts?.limit ?? 250));
  const pageSize = Math.max(25, Math.min(500, opts?.pageSize ?? 200));
  const out: IndexedPatientIdentity[] = [];

  const gql = `
    query SearchPatientIdentities($q: String!, $first: Int!, $skip: Int!) {
      identities(
        where: { role: "patient", title_contains_nocase: $q }
        first: $first
        skip: $skip
        orderBy: updatedAtBlock
        orderDirection: desc
      ) {
        id
        wallet
        role
        lockACid
        title
        updatedAtBlock
      }
    }
  `;

  let skip = 0;
  while (out.length < limit) {
    const data = await runSubgraphQuery<{
      identities?: Array<{
        id: string;
        wallet: string;
        role: string;
        lockACid: string;
        title?: string;
        updatedAtBlock?: string;
      }>;
    }>(gql, { q, first: pageSize, skip });
    const rows = data?.identities ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const wallet = (row.wallet || "").toLowerCase();
      if (!wallet || !row.lockACid) continue;
      out.push({
        id: row.id,
        wallet,
        role: row.role || "patient",
        lockACid: row.lockACid,
        title: row.title || undefined,
        updatedAtBlock: Number(row.updatedAtBlock || 0) || undefined,
      });
      if (out.length >= limit) break;
    }

    if (rows.length < pageSize) break;
    skip += pageSize;
  }

  return out;
}

export async function listGrantedPatientWalletsForDoctorFromSubgraph(
  doctorWallet: string
): Promise<string[]> {
  const wallet = (doctorWallet || "").trim().toLowerCase();
  if (!SUBGRAPH_URL || !wallet) return [];

  const gql = `
    query GrantsForDoctor($wallet: String!) {
      accessGrants(where: { grantee: $wallet, revokedAtBlock: null }, first: 1000) {
        recordId
      }
    }
  `;

  const grantsData = await runSubgraphQuery<{
    accessGrants?: Array<{ recordId: string }>;
  }>(gql, { wallet });
  const recordIds = Array.from(
    new Set((grantsData?.accessGrants || []).map((g) => (g.recordId || "").trim()).filter(Boolean))
  );
  if (recordIds.length === 0) return [];

  const recordsGql = `
    query RecordsByIds($ids: [String!]) {
      records(where: { id_in: $ids }, first: 1000) {
        id
        patient
      }
    }
  `;
  const recordsData = await runSubgraphQuery<{
    records?: Array<{ id: string; patient: string }>;
  }>(recordsGql, { ids: recordIds });

  const wallets = (recordsData?.records || [])
    .map((r) => (r.patient || "").trim().toLowerCase())
    .filter((w) => w.startsWith("0x") && w.length === 42);

  return Array.from(new Set(wallets));
}

export async function listAccessGrantsForPatientFromSubgraph(
  patientWallet: string
): Promise<Array<{ doctorAddress: string; recordId: string; encDekIpfsCid: string }>> {
  const wallet = (patientWallet || "").trim().toLowerCase();
  if (!SUBGRAPH_URL || !wallet || !wallet.startsWith("0x") || wallet.length !== 42) return [];

  const recordsGql = `
    query RecordsForPatient($wallet: String!) {
      records(where: { patient: $wallet, active: true }, first: 1000) {
        id
      }
    }
  `;
  const recordsData = await runSubgraphQuery<{
    records?: Array<{ id: string }>;
  }>(recordsGql, { wallet });
  const recordIds = Array.from(
    new Set((recordsData?.records || []).map((r) => (r.id || "").trim()).filter(Boolean))
  );
  if (recordIds.length === 0) return [];

  const grantsGql = `
    query ActiveGrantsByRecordIds($ids: [String!]) {
      accessGrants(where: { recordId_in: $ids, revokedAtBlock: null }, first: 2000) {
        recordId
        grantee
        encDekIpfsCid
      }
    }
  `;
  const grantsData = await runSubgraphQuery<{
    accessGrants?: Array<{ recordId: string; grantee: string; encDekIpfsCid?: string | null }>;
  }>(grantsGql, { ids: recordIds });

  return (grantsData?.accessGrants || [])
    .map((g) => ({
      doctorAddress: (g.grantee || "").trim().toLowerCase(),
      recordId: (g.recordId || "").trim(),
      encDekIpfsCid: (g.encDekIpfsCid || "").trim(),
    }))
    .filter(
      (g) =>
        g.recordId.length > 0 &&
        g.doctorAddress.startsWith("0x") &&
        g.doctorAddress.length === 42 &&
        g.encDekIpfsCid.length > 0
    );
}

export async function getEncDekCidForRecordGranteeFromSubgraph(
  recordId: string,
  granteeWallet: string
): Promise<string | null> {
  const rid = (recordId || "").trim().toLowerCase();
  const grantee = (granteeWallet || "").trim().toLowerCase();
  if (!SUBGRAPH_URL || !rid || !grantee || !grantee.startsWith("0x") || grantee.length !== 42) {
    return null;
  }

  const gql = `
    query GrantForRecordAndGrantee($recordId: String!, $grantee: String!) {
      accessGrants(
        where: { recordId: $recordId, grantee: $grantee, revokedAtBlock: null }
        first: 1
      ) {
        encDekIpfsCid
      }
    }
  `;
  const data = await runSubgraphQuery<{
    accessGrants?: Array<{ encDekIpfsCid?: string | null }>;
  }>(gql, { recordId: rid, grantee });

  const cid = (data?.accessGrants?.[0]?.encDekIpfsCid || "").trim();
  return cid || null;
}

export async function listRecordsUploadedByDoctorFromSubgraph(
  doctorWallet: string
): Promise<Array<{ recordId: string; patient: string; fileCid: string; fileType: string; timestamp: number }>> {
  const wallet = (doctorWallet || "").trim().toLowerCase();
  if (!SUBGRAPH_URL || !wallet || !wallet.startsWith("0x") || wallet.length !== 42) return [];

  const gql = `
    query RecordsUploadedByDoctor($wallet: String!) {
      records(where: { uploader: $wallet, active: true }, first: 1000, orderBy: timestamp, orderDirection: desc) {
        id
        patient
        fileCid
        fileType
        timestamp
      }
    }
  `;
  const data = await runSubgraphQuery<{
    records?: Array<{
      id: string;
      patient: string;
      fileCid: string;
      fileType: string;
      timestamp?: string | number;
    }>;
  }>(gql, { wallet });

  return (data?.records || [])
    .map((r) => ({
      recordId: (r.id || "").trim(),
      patient: (r.patient || "").trim().toLowerCase(),
      fileCid: (r.fileCid || "").trim(),
      fileType: (r.fileType || "").trim(),
      timestamp: Number(r.timestamp || 0),
    }))
    .filter(
      (r) =>
        r.recordId.length > 0 &&
        r.patient.startsWith("0x") &&
        r.patient.length === 42 &&
        r.fileCid.length > 0
    );
}

export async function listHospitalsFromSubgraph(): Promise<IndexedHospital[]> {
  if (!SUBGRAPH_URL) return [];
  const gql = `
    query ListHospitals {
      hospitals(first: 100) {
        id
        name
        code
        city
        state
        type
      }
    }
  `;
  const data = await runSubgraphQuery<{
    hospitals?: Array<{
      id: string;
      name?: string;
      code?: string;
      city?: string;
      state?: string;
      type?: string;
    }>;
  }>(gql, {});

  return (data?.hospitals ?? [])
    .filter((h) => typeof h.name === "string" && h.name.trim().length > 0)
    .map((h) => ({
      id: h.id,
      name: h.name as string,
      code: h.code || undefined,
      city: h.city || undefined,
      state: h.state || undefined,
      type: h.type || undefined,
    }));
}

export function hasSubgraphDirectory(): boolean {
  return !!SUBGRAPH_URL;
}
