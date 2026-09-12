"use client";

import { useState, useRef } from "react";
import ButterflyBackground from "@/components/butterflies/ButterflyBackground";
import { FileText, Loader2, Check, Info } from "lucide-react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setFile(selectedFile);
      setLoading(false);
      setSuccess(true);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#D7D8D0] p-10 font-sans">
      <div className="relative flex flex-1 overflow-hidden rounded-[40px] bg-white">
        <ButterflyBackground />

        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4">
          <div className="w-full flex justify-between items-start mb-8">
            <div>
              <h1>UPLOAD</h1>
              <h2 className="text-lg text-left whitespace-nowrap">
                Upload your book to explore its emotional DNA.
              </h2>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="p-2 rounded-full hover:bg-stone-100 transition-colors"
              >
                <Info className="w-6 h-6 text-stone-600 hover:text-stone-900" />
              </button>

              {showInfo && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-300 rounded-lg shadow-lg p-4 z-50">
                  <h3 className="font-semibold text-stone-900 mb-2">
                    Privacy & Copyright
                  </h3>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    All PDF processing occurs locally in your browser. Your
                    files are never uploaded to our servers or stored anywhere.
                    This means:
                  </p>
                  <ul className="text-sm text-stone-700 mt-3 space-y-1 list-disc list-inside">
                    <li>
                      Complete privacy - your PDFs never leave your device
                    </li>
                    <li>Full compliance with copyright laws</li>
                    <li>No data collection or tracking</li>
                    <li>All processing is instantaneous and secure</li>
                  </ul>
                  <button
                    onClick={() => setShowInfo(false)}
                    className="mt-4 text-sm text-[#4D8937] hover:text-[#3a6b2b] font-medium"
                  >
                    Got it
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 w-full">
            <div
              className={`w-full border-2 border-dashed bg-white rounded-lg py-8 px-8 text-center cursor-pointer transition-all duration-300 ${
                loading
                  ? "border-[#4D8937] bg-[#4D8937]/10"
                  : success
                    ? "border-[#4D8937] bg-[#4D8937]/10"
                    : "border-stone-400 hover:border-[#4D8937] hover:bg-[#4D8937]/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add(
                  "border-[#4D8937]",
                  "bg-[#4D8937]/30",
                );
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove(
                  "border-[#4D8937]",
                  "bg-[#4D8937]/30",
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile && droppedFile.type === "application/pdf") {
                  const event = {
                    target: { files: [droppedFile] },
                  } as unknown as React.ChangeEvent<HTMLInputElement>;
                  handleFileChange(event);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                id="file-input"
                onChange={handleFileChange}
              />

              {loading ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-[#4D8937] animate-spin" />
                  <p className="text-[#4D8937] font-medium">Uploading...</p>
                </div>
              ) : success && file ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Check className="w-8 h-8 text-[#4D8937]" />
                  <p className="text-[#4D8937] font-medium">
                    Upload successful!
                  </p>
                </div>
              ) : (
                <label htmlFor="file-input" className="cursor-pointer block">
                  <p className="text-stone-600 font-medium">
                    Drag and Drop the File
                  </p>
                  <p className="text-stone-500 my-2">or</p>
                  <p className="text-stone-600 font-medium hover:text-stone-800">
                    Choose File
                  </p>
                </label>
              )}
            </div>

            {file && success && (
              <div className="mt-6 flex items-center justify-between gap-4 border border-stone-300 rounded-lg p-4 bg-stone-50">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-stone-600" />
                  <div className="text-left">
                    <p className="font-medium text-stone-900">{file.name}</p>
                    <div className="flex gap-4 text-sm text-stone-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDate(new Date(file.lastModified))}</span>
                    </div>
                  </div>
                </div>
                <button className="px-6 py-2 bg-[#4D8937] text-white rounded-lg font-medium hover:bg-[#3a6b2b] transition-all duration-300">
                  Submit
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
