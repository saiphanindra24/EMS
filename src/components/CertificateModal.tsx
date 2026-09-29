"use client";

import { Modal, Button } from "./ui";
import { BrandLogo } from "./BrandLogo";

export interface CertificateData {
  id: number;
  certificateNumber: string;
  trainingTitle: string;
  completionDate: string;
  score: string | null;
  issueDate: string;
  expiryDate: string | null;
  employeeName?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  certificate: CertificateData | null;
}

export function CertificateModal({ open, onClose, certificate }: Props) {
  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal open={open} onClose={onClose} title="Certificate of Completion">
      <div className="space-y-6">
        {/* Printable Branded Certificate */}
        <div
          id="printable-certificate"
          className="relative overflow-hidden rounded-2xl border-4 border-double border-violet-200 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-8 text-center shadow-lg"
        >
          {/* Subtle background ornamentation */}
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-100/50 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-indigo-100/50 blur-2xl pointer-events-none" />

          {/* Logo & Header */}
          <div className="flex justify-center">
            <BrandLogo className="h-9 w-auto" />
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
            VolkssKatt Learning & Development
          </p>

          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Certificate of Completion
          </h2>

          <p className="mt-3 text-xs italic text-slate-500">This is proudly awarded to</p>

          {/* Recipient Name */}
          <div className="my-3 border-b-2 border-slate-300 pb-1 inline-block min-w-[280px]">
            <p className="text-xl font-bold text-slate-900">
              {certificate.employeeName || "Employee"}
            </p>
          </div>

          <p className="text-xs text-slate-600">for successfully completing the specialized training program in</p>

          {/* Training Title */}
          <p className="mt-2 text-lg font-semibold text-violet-700">
            {certificate.trainingTitle}
          </p>

          {/* Score & Issue Details */}
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl bg-white/80 p-3 text-[11px] shadow-sm ring-1 ring-slate-200/60">
            <div>
              <span className="text-slate-400">Score Achieved:</span>
              <p className="font-semibold text-slate-800">{certificate.score ? `${certificate.score}%` : "Passed"}</p>
            </div>
            <div>
              <span className="text-slate-400">Date Issued:</span>
              <p className="font-semibold text-slate-800">{certificate.issueDate}</p>
            </div>
            <div>
              <span className="text-slate-400">Certificate ID:</span>
              <p className="font-mono font-semibold text-slate-800">{certificate.certificateNumber}</p>
            </div>
          </div>

          {/* Signature Lines */}
          <div className="mt-8 flex items-end justify-between px-6 text-center text-xs">
            <div>
              <div className="h-0.5 w-28 bg-slate-400 mx-auto" />
              <p className="mt-1 font-semibold text-slate-700">Program Trainer</p>
              <p className="text-[10px] text-slate-400">VolkssKatt L&D</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-violet-50 text-[10px] font-bold uppercase text-violet-700">
              Verified
            </div>
            <div>
              <div className="h-0.5 w-28 bg-slate-400 mx-auto" />
              <p className="mt-1 font-semibold text-slate-700">Director of Training</p>
              <p className="text-[10px] text-slate-400">Executive Office</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-3.414 2.45-6.329 5.86-6.329s6.1 2.915 5.86 6.329m-11.72 0h11.72m-11.72 0L5 18h14l-1.72-4.171M6 18v3h12v-3" />
            </svg>
            Print / Save Certificate PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
