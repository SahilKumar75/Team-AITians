"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import RecordViewer from "@/components/record-viewer";
import {
  ArrowLeft, FileText, Calendar, User, Eye, X, Loader2,
  Upload, UserCircle2, Stethoscope, Filter,
} from "lucide-react";
import { PatientUploadModal } from "@/components/patient/PatientUploadModal";
import { listRecords } from "@/features/records/api";
import { listDoctorsByWalletsFromSubgraph } from "@/lib/subgraph-directory";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateByLanguage } from "@/lib/i18n/format";

// ─── Source classification ────────────────────────────────────────────────────

type RecordSource = "self" | "doctor";

const SOURCE_CONFIG: Record<
  RecordSource,
  { label: string; Icon: React.ElementType; badgeCls: string; cardBorderCls: string; iconBgCls: string; iconCls: string }
> = {
  self: {
    label: "Self-uploaded", Icon: UserCircle2,
    badgeCls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    cardBorderCls: "border-violet-200 dark:border-violet-800",
    iconBgCls: "bg-violet-50 dark:bg-violet-900/20", iconCls: "text-violet-600 dark:text-violet-400",
  },
  doctor: {
    label: "By Doctor", Icon: Stethoscope,
    badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    cardBorderCls: "border-blue-200 dark:border-blue-700",
    iconBgCls: "bg-blue-50 dark:bg-blue-900/20", iconCls: "text-blue-600 dark:text-blue-400",
  },
};

type FilterTab = "all" | RecordSource;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MedicalRecord {
  id: string; patientId: string; doctorId: string; recordHash: string;
  timestamp: string; isActive: boolean; doctorName?: string; fileType?: string;
  source: RecordSource; providerName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "Unknown";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function classifyRecord(uploader: string, patientWallet: string): RecordSource {
  const u = (uploader || "").toLowerCase();
  const p = (patientWallet || "").toLowerCase();
  if (!u || u === p) return "self";
  return "doctor";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientRecordsPage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const { t, tx, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/auth/login"); return; }
    if (status === "authenticated") loadRecords();
    if (status !== "loading") setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  async function loadRecords() {
    try {
      setLoadingRecords(true);
      const patientAddress = session?.user?.walletAddress ?? undefined;

      const ownData = await listRecords(patientAddress ? { patientAddress } : undefined);

      const rawRecords = (ownData.records || []).map((r) => {
        const raw = r as Record<string, unknown>;
        const hash = (raw.fileCid ?? raw.recordHash ?? "") as string;
        const rawTs = raw.timestamp;
        const tsISO = typeof rawTs === "number" ? new Date(rawTs * 1000).toISOString()
          : typeof rawTs === "string" ? rawTs : new Date().toISOString();
        const uploaderId = ((raw.uploader ?? raw.doctorId ?? "") as string).toLowerCase();
        const source = classifyRecord(uploaderId, patientAddress ?? "");
        return {
          id: (raw.id ?? "") as string,
          patientId: (raw.patient ?? raw.patientId ?? "") as string,
          doctorId: uploaderId,
          recordHash: hash, timestamp: tsISO, isActive: raw.active !== false,
          doctorName: (raw.doctorName ?? undefined) as string | undefined,
          fileType: (raw.fileType ?? undefined) as string | undefined,
          source,
          providerName: source === "doctor"
            ? ((raw.doctorName as string | undefined) ?? undefined)
            : undefined,
        };
      });

      // Resolve doctor names from subgraph
      const doctorWalletSet = new Set<string>();
      rawRecords
        .filter((r) => r.source === "doctor" && !r.providerName && r.doctorId)
        .forEach((r) => doctorWalletSet.add(r.doctorId));
      const doctorWalletsArr = Array.from(doctorWalletSet);
      const nameMap = new Map<string, string>();
      if (doctorWalletsArr.length > 0) {
        try {
          const docs = await listDoctorsByWalletsFromSubgraph(doctorWalletsArr);
          docs.forEach((d) => { if (d.name) nameMap.set(d.walletAddress.toLowerCase(), d.name); });
        } catch { /* subgraph unavailable */ }
      }

      const normalized: MedicalRecord[] = rawRecords.map((r) => ({
        ...r,
        providerName: r.source === "doctor"
          ? (r.providerName ?? nameMap.get(r.doctorId) ?? shortenAddress(r.doctorId))
          : r.providerName,
      }));

      setRecords(normalized);
    } catch (err) {
      console.error("Error loading records:", err);
    } finally {
      setLoadingRecords(false);
    }
  }

  const formatDate = (ts: string) =>
    formatDateByLanguage(ts, language, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filteredRecords = useMemo(
    () => activeFilter === "all" ? records : records.filter((r) => r.source === activeFilter),
    [records, activeFilter]
  );

  const counts = useMemo(() => ({
    all: records.length,
    self: records.filter((r) => r.source === "self").length,
    doctor: records.filter((r) => r.source === "doctor").length,
  }), [records]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 pt-24">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-1">{t.portal.records.myRecords}</h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              {t.portal.records.myRecordsDesc}
            </p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Upload className="w-5 h-5" />
            {t.portal.records.uploadNew}
          </button>
        </div>

        {/* Filter tabs */}
        {records.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Filter className="w-4 h-4 text-neutral-400 mr-1" />
            {(["all", "self", "doctor"] as FilterTab[]).map((tab) => {
              const cfg = tab !== "all" ? SOURCE_CONFIG[tab as RecordSource] : null;
              const active = activeFilter === tab;
              return (
                <button key={tab} onClick={() => setActiveFilter(tab)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${active
                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-transparent"
                      : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                    }`}>
                  {cfg && <cfg.Icon className="w-3.5 h-3.5" />}
                  {tab === "all" ? tx("All") : tx(cfg!.label)}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-white/20 dark:bg-black/20 text-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"}`}>
                    {counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Records grid */}
        {loadingRecords ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <FileText className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
              {activeFilter === "all"
                ? t.portal.records.noRecords
                : activeFilter === "self"
                  ? tx("No Self-uploaded Records")
                  : tx("No By Doctor Records")}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
              {activeFilter === "all"
                ? t.portal.records.uploadFirst
                : tx("Switch to 'All' to see your other records.")}
            </p>
            <Link href="/patient/home"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition">
              <ArrowLeft className="w-4 h-4" /> {t.portal.records.backToDashboard}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecords.map((record) => {
              const cfg = SOURCE_CONFIG[record.source];
              const { Icon } = cfg;
              return (
                <div key={record.id}
                  className={`bg-white dark:bg-neutral-800 rounded-xl border-2 ${cfg.cardBorderCls} p-5 hover:shadow-lg transition-shadow flex flex-col`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-lg ${cfg.iconBgCls}`}>
                      <Icon className={`w-5 h-5 ${cfg.iconCls}`} />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badgeCls}`}>
                      <Icon className="w-3 h-3" />
                      {tx(cfg.label)}
                    </span>
                  </div>

                  {/* Fields */}
                  <div className="space-y-2.5 mb-4 flex-1">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {record.source === "self" ? t.portal.records.uploadedBy : t.portal.records.doctor}
                      </p>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        {record.source === "self" ? tx("You") : (record.providerName ?? shortenAddress(record.doctorId))}
                      </p>
                    </div>
                    {record.fileType && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5">{t.portal.records.recordType}</p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300">{record.fileType}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {t.portal.records.uploadDate}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">{formatDate(record.timestamp)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5">{t.portal.records.ipfsHash}</p>
                      <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate">
                        {record.recordHash ? record.recordHash.slice(0, 26) + "…" : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => setSelectedRecord(record)}
                    className="w-full px-3 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition font-medium flex items-center justify-center gap-2 text-sm">
                    <Eye className="w-4 h-4" /> {t.portal.records.viewRecord}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Record viewer modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                {(() => {
                  const cfg = SOURCE_CONFIG[selectedRecord.source];
                  const { Icon } = cfg;
                  return (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badgeCls}`}>
                      <Icon className="w-3 h-3" />{tx(cfg.label)}
                    </span>
                  );
                })()}
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                    {selectedRecord.fileType ?? t.portal.records.medicalRecord}
                  </h3>
                  {selectedRecord.source === "doctor" && selectedRecord.providerName && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t.portal.records.doctor}: {selectedRecord.providerName}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-68px)] p-6">
              <RecordViewer
                recordHash={selectedRecord.recordHash}
                recordId={selectedRecord.id}
                metadata={{
                  doctor: selectedRecord.source === "doctor" ? selectedRecord.providerName : undefined,
                  timestamp: BigInt(Math.floor(new Date(selectedRecord.timestamp).getTime() / 1000)),
                  notes: `${t.portal.records.recordId}: ${selectedRecord.id}`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <PatientUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={loadRecords}
      />
    </div>
  );
}
