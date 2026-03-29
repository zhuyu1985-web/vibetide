"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportButtonsProps {
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

export function ExportButtons({ onExportPDF, onExportExcel }: ExportButtonsProps) {
  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else {
      alert("导出 PDF 功能即将上线，敬请期待");
    }
  };

  const handleExportExcel = () => {
    if (onExportExcel) {
      onExportExcel();
    } else {
      alert("导出 Excel 功能即将上线，敬请期待");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={handleExportPDF}
      >
        <Download size={14} />
        导出 PDF
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={handleExportExcel}
      >
        <Download size={14} />
        导出 Excel
      </Button>
    </div>
  );
}
