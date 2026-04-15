"use client";

import { useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { parsePortfolioCSV } from "@/lib/csv-parser";
import { ManualEntryForm } from "./ManualEntryForm";
import { Upload, FileText } from "lucide-react";
import type { RawPosition } from "@/types/portfolio";

interface Props {
  onPositionsReady: (positions: RawPosition[], source: "csv" | "manual") => void;
  disabled?: boolean;
}

export function PortfolioUploader({ onPositionsReady, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<RawPosition[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const { positions, errors } = await parsePortfolioCSV(file);
    setParseErrors(errors);
    if (errors.length === 0 || positions.length > 0) {
      setPreview(positions);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Tabs defaultValue="csv">
      <TabsList className="mb-4">
        <TabsTrigger value="csv">Upload CSV</TabsTrigger>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
      </TabsList>

      <TabsContent value="csv">
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              {fileName ?? "Drop your CSV here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Required columns: <code>ticker</code>, <code>shares</code>, <code>cost_basis</code>
              {" "}· Optional: <code>currency</code> (EUR/USD, default EUR)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {parseErrors.length > 0 && (
            <ul className="text-sm text-destructive space-y-0.5">
              {parseErrors.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Preview ({preview.length} positions)
              </div>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Ticker</th>
                      <th className="text-right px-3 py-2 font-medium">Shares</th>
                      <th className="text-right px-3 py-2 font-medium">Cost Basis</th>
                      <th className="text-right px-3 py-2 font-medium">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono font-medium">{p.ticker}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{p.shares.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{p.costBasis.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">{p.currency}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={3} className="px-3 py-1.5 text-center text-muted-foreground text-xs">
                          +{preview.length - 10} more positions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Button
                onClick={() => onPositionsReady(preview, "csv")}
                disabled={disabled}
              >
                Analyze {preview.length} Positions
              </Button>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="manual">
        <ManualEntryForm
          onPositionsReady={(p) => onPositionsReady(p, "manual")}
          disabled={disabled}
        />
      </TabsContent>
    </Tabs>
  );
}
